import type { Certificate } from "@pulumi/aws/acm/index.js";
import {
	Distribution,
	Function,
	OriginAccessIdentity,
} from "@pulumi/aws/cloudfront/index.js";
import {
	Dashboard,
	type DashboardArgs,
	MetricAlarm,
	type MetricAlarmArgs,
} from "@pulumi/aws/cloudwatch/index.js";
import { Permission } from "@pulumi/aws/lambda/index.js";
import {
	BucketAclV2,
	BucketLifecycleConfigurationV2,
	BucketObject,
	BucketOwnershipControls,
	type BucketPolicy,
	BucketV2,
	CannedAcl,
} from "@pulumi/aws/s3/index.js";
import { Command } from "@pulumi/command/local/index.js";
import {
	type ComponentResourceOptions,
	Output,
	all,
	interpolate,
	jsonStringify,
} from "@pulumi/pulumi/index.js";
import {
	AwsCloudfrontCachePolicy,
	AwsCloudfrontRequestPolicy,
} from "../aws/AwsCloudfront.js";
import type { ComputeManifest } from "../compute/ComputeManifest.js";
import type { BunComponentAws } from "../compute/bun/BunComponentAws.Linux.js";
import type { BunComponentAwsAssetsState } from "../compute/bun/aws/BunComponentAwsAssets.js";
import type { NodejsComponentAws } from "../compute/nodejs/NodejsComponentAws.js";
import type { WebsiteComponentAws } from "../website/WebsiteComponentAws.js";
import type {
	LambdaRouteResource,
	Prefix,
	Route,
	Service,
	WebsiteManifest,
} from "../website/WebsiteManifest.js";
import { CdnComponent, type CdnComponentProps } from "./CdnComponent.js";
import { CdnComponentAwsDashboard } from "./CdnComponentAwsDashboard.js";

export type CdnComponentAwsProps = {
	routes?: Output<Record<Service, Record<Prefix, Route<LambdaRouteResource>>>>;
	certificate?: Certificate;
	monitor?: {
		alarms?: MetricAlarmArgs[];
		dashboard?: DashboardArgs;
	};
	renderManifest?: boolean;
} & (
	| {
			compute?: NodejsComponentAws;
			assets?: WebsiteComponentAws;
			computePrefix?: string;
	  }
	| {
			compute?: BunComponentAws;
			assets?: BunComponentAwsAssetsState;
			computePrefix?: string;
	  }
) &
	Omit<CdnComponentProps, "routes">;

export interface CdnComponentAwsState {
	iam: {
		identity: OriginAccessIdentity;
		policy?: BucketPolicy;
	};
	monitor?: {
		logs: BucketV2;
		alarms?: MetricAlarm[];
		dashboard?: Dashboard;
	};
	cache: Distribution;
	function: {
		rewriteUrls: Function;
	};
	manifest?: {
		content: Output<{ CdnComponent: WebsiteManifest }>;
	};
}

export class CdnComponentAws extends CdnComponent {
	static readonly URN = "cdn:aws::website";
	aws: CdnComponentAwsState;

	constructor(
		name: string,
		props: CdnComponentAwsProps,
		opts?: ComponentResourceOptions,
	) {
		super(CdnComponentAws.URN, name, props, opts);
		const {
			compute,
			context,
			routes,
			certificate,
			monitor,
			renderManifest = false,
			computePrefix: computePath,
		} = props;
		const publicPath = props.assets?.publicPath;
		const { websiteContent, bucketArn, bucketDomainName, manifestAcl } = {
			websiteContent: props.assets?.aws.manifest?.content.WebsiteComponent,
			bucketArn: props.assets?.aws.bucket.arn,
			bucketDomainName: props.assets?.aws.bucket.bucketDomainName,
			manifestAcl: CannedAcl.PublicRead,
		};

		this.aws = (() => {
			const identity = new OriginAccessIdentity(
				`${name}-Cdn-iam--origin-access-identity`,
				{
					comment: `OAI for ${name}`,
				},
				{ parent: this },
			);

			// let policy = new BucketPolicy(
			//     `${name}-Cdn-iam--bucket-policy`,
			//     {
			//       bucket: bucketArn,
			//       policy: all([bucketArn, identity.iamArn])
			//         .apply(([arn, identity]) => {
			//           return getPolicyDocument({
			//             statements: [
			//               {
			//                 actions: ["s3:GetObject"],
			//                 resources: [`${arn}/*`],
			//                 principals: [
			//                   {
			//                     type: "AWS",
			//                     identifiers: [identity],
			//                   },
			//                 ],
			//               },
			//             ],
			//           });
			//         })
			//         .apply((policy) => {
			//           console.debug({
			//             CdnComponentAws: {
			//               policy,
			//               st: JSON.stringify(policy, null, 4),
			//             },
			//           });
			//           return policy.json;
			//         }),
			//     },
			//     { parent: this },
			//   );

			if (`${name}-Cdn--cache-rewrite-url`.length > 64 - 8) {
				const combined = `${name}-Cdn--cache-rewrite-url`;
				throw new Error(
					`Combined name of function too long: ${combined} (${combined.length})`,
				);
			}

			const rewriteUrls = new Function(
				`${name}-Cdn--cache-rewrite-url`,
				{
					runtime: "cloudfront-js-2.0",
					code: `
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
      request.uri = '/index.html';
  } else if (!uri.includes('.')) {
      request.uri = '/index.html';
  }
  return request;
}
              `,
				},
				{ parent: this },
			);

			const hostHeaderInjection = new Function(
				`${name}-Cdn--cache-host-header`,
				{
					runtime: "cloudfront-js-2.0",
					code: `
function handler(event) {
  event.request.uri = event.request.uri.split('/').map(encodeURIComponent).join('/');
  event.request.headers["x-forwarded-host"] = event.request.headers.host;
  return event.request;
}
              `,
				},
				{ parent: this },
			);

			if (`${hostHeaderInjection}-Cdn--cache-host-header`.length > 64 - 8) {
				const combined = `${name}-Cdn--cache-host-header`;
				throw new Error(
					`Combined name of lambda too long: ${combined} (${combined.length})`,
				);
			}

			const hostnames = context.frontend?.dns?.hostnames ?? [];
			const origins = all([
				routes ?? {},
				(compute as NodejsComponentAws)?.aws?.http?.url.functionUrl ?? "",
				props.assets?.aws.website.websiteEndpoint,
			]).apply(([routes, url, website]) => {
				console.debug({
					CdnComponentAws: {
						routes,
						hostnames,
						url,
					},
				});
				const defaultOrigin: {
					originId: string;
					domainName: string;
					prefix: string;
				}[] = [];

				if (website === undefined && url === "") {
					console.warn({
						CdnComponentAws: {
							message:
								"!!!!!!!!! WARNING !!!!!!!!!\n No website or compute endpoint defined. This will fail resource creation",
						},
					});
					throw new Error("No website or compute endpoint defined");
				}

				defaultOrigin.push({
					originId: "default__origin__assets",
					domainName: website ?? "",
					prefix: compute && computePath === undefined ? `/${publicPath}` : "",
				} as const);

				if (url !== "") {
					const [, host] = url.split("://");
					const domainName = `${host.at(-1) !== "/" ? host : host?.slice(0, host?.length - 1)}`;
					if (defaultOrigin[0].domainName === "") {
						defaultOrigin[0].domainName = domainName;
					}
					defaultOrigin.push({
						originId: "default__origin__compute",
						domainName,
						prefix: computePath ? `/${computePath}` : "",
					} as const);
				}

				return [
					...Object.entries(routes).flatMap(([, routes]) =>
						Object.entries(routes).flatMap(([prefix, { url }]) => {
							if (url?.startsWith("http")) {
								console.warn({
									CdnComponentAws: {
										message:
											"!!!!!!!!! WARNING !!!!!!!!!\n Urls should not start with http or https. This will fail resource creation",
										url,
									},
								});
							}

							return {
								originId: prefix.replaceAll("/", "_"),
								domainName: `${url?.at(-1) !== "/" ? url : url?.slice(0, url?.length - 1)}`,
								prefix,
							};
						}),
					),
					...defaultOrigin,
				];
			});

			const logs = new BucketV2(
				`${name}-Cdn-monitor--logs`,
				{},
				{ parent: this },
			);
			const ownership = new BucketOwnershipControls(
				`${name}-Cdn-monitor--logs-ownership-controls`,
				{
					bucket: logs.bucket,
					rule: {
						objectOwnership: "BucketOwnerPreferred",
					},
				},
				{ parent: this },
			);
			const acl = new BucketAclV2(
				`${name}-Cdn-monitor--logs-acl`,
				{
					bucket: logs.bucket,
					acl: CannedAcl.Private,
				},
				{ parent: this, dependsOn: ownership },
			);
			new BucketLifecycleConfigurationV2(
				`${name}-Cdn-monitor--logs-lifecycle`,
				{
					bucket: logs.bucket,
					rules: [
						{
							id: "expire30days",
							status: context.environment.isProd ? "Disabled" : "Enabled",
							expiration: {
								days: 30,
							},
						},
					],
				},
				{ parent: this },
			);

			const cache = new Distribution(
				`${name}-Cdn--cache`,
				{
					enabled: true,
					comment: `CDN for ${name}`,
					httpVersion: "http2and3",
					priceClass: "PriceClass_100",
					isIpv6Enabled: true,
					aliases: hostnames
						?.filter((hostname) => {
							return hostname !== "localhost";
						})
						.flatMap((hostname) => [hostname, `www.${hostname}`]),
					viewerCertificate: {
						acmCertificateArn: certificate?.arn,
						cloudfrontDefaultCertificate: true,
					},
					origins:
						origins === undefined
							? []
							: all([
									origins,
									bucketDomainName,
									identity.cloudfrontAccessIdentityPath,
								]).apply(
									([
										origins,
										bucketDomainName,
										cloudfrontAccessIdentityPath,
									]) => {
										const applied = [
											...(bucketDomainName !== undefined
												? [
														{
															originId: bucketDomainName,
															domainName: bucketDomainName,
															s3OriginConfig: {
																originAccessIdentity:
																	cloudfrontAccessIdentityPath,
															},
														},
													]
												: []),
											...origins
												.filter(({ originId }) => {
													return originId !== bucketDomainName;
												})
												.map(({ originId, domainName }) => ({
													originId,
													domainName,
													customOriginConfig: {
														httpPort: 80,
														httpsPort: 443,
														originProtocolPolicy:
															originId === "default__origin__assets"
																? "http-only"
																: "https-only",
														originReadTimeout: 20,
														originSslProtocols: ["TLSv1.2"],
													},
												})),
										];
										console.debug({
											CdnComponentAws: {
												origins: JSON.stringify(applied, null, 4),
												applied,
											},
										});
										return applied;
									},
								),
					defaultCacheBehavior: {
						cachePolicyId:
							props.compute === undefined
								? AwsCloudfrontCachePolicy.OPTIMIZED
								: AwsCloudfrontCachePolicy.DISABLED,
						targetOriginId:
							props.compute !== undefined && computePath === undefined
								? "default__origin__compute"
								: (bucketDomainName ?? ""),
						functionAssociations: [
							{
								functionArn:
									props.compute === undefined && computePath !== undefined
										? rewriteUrls.arn
										: hostHeaderInjection.arn,
								eventType: "viewer-request",
							},
						],
						viewerProtocolPolicy: "redirect-to-https",
						allowedMethods:
							props.compute === undefined && computePath !== undefined
								? ["HEAD", "GET", "OPTIONS"]
								: ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"],
						cachedMethods: ["HEAD", "GET", "OPTIONS"],
						compress: true,
						originRequestPolicyId:
							props.compute !== undefined && computePath === undefined
								? AwsCloudfrontRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
								: undefined,
					},
					orderedCacheBehaviors:
						origins === undefined
							? []
							: all([origins]).apply(([origins]) => {
									const allorigins = origins
										.filter(({ originId }) => {
											return (
												props.compute === undefined ||
												originId !== "default__origin__compute" ||
												(props.compute !== undefined &&
													computePath !== undefined &&
													originId === "default__origin__compute")
											);
										})
										.flatMap(({ prefix, originId: targetOriginId }) => {
											return {
												pathPattern: `${prefix}/*`,
												targetOriginId,
												cachePolicyId:
													targetOriginId === "default__origin__assets"
														? AwsCloudfrontCachePolicy.OPTIMIZED
														: AwsCloudfrontCachePolicy.DISABLED,
												originRequestPolicyId:
													AwsCloudfrontRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
												viewerProtocolPolicy: "redirect-to-https",
												allowedMethods: [
													"HEAD",
													"DELETE",
													"POST",
													"GET",
													"OPTIONS",
													"PUT",
													"PATCH",
												],
												functionAssociations: targetOriginId.startsWith(
													"default__origin",
												)
													? [
															{
																functionArn:
																	targetOriginId === "default__origin__assets"
																		? rewriteUrls.arn
																		: hostHeaderInjection.arn,
																eventType: "viewer-request",
															},
														]
													: undefined,
												cachedMethods: ["HEAD", "GET"],
												compress: targetOriginId === "default__origin__assets",
											};
										});
									console.debug({
										CdnComponentAws: {
											allorigins: JSON.stringify(allorigins, null, 4),
										},
									});
									return allorigins;
								}),
					loggingConfig: {
						bucket: logs.bucketDomainName,
						includeCookies: false,
						prefix: "",
					},
					restrictions: {
						geoRestriction: {
							restrictionType: "none",
						},
					},
				},
				{ parent: this, protect: true, dependsOn: [acl] },
			);
			const isManifestOk = websiteContent;
			const version = all([isManifestOk, websiteContent]).apply(
				([m, content]) => {
					return m?.manifest.ok && content?.manifest.ok === true
						? Output.create([
								{
									build: content.manifest.version.build,
									stage: content.manifest.version.stage,
								},
							])
						: Output.create([
								{
									build: "0",
									stage: "dev",
								},
							]);
				},
			);

			const triggers = version.apply((a) => {
				return a.map((m) => m.build);
			});
			new Command(
				`${name}-Cdn--cache-invalidation`,
				{
					create: interpolate`aws cloudfront create-invalidation --distribution-id ${cache.id} --paths '/*'`,
					triggers,
				},
				{
					parent: this,
					protect: false,
					deleteBeforeReplace: true,
				},
			);

			routes === undefined
				? []
				: all([
						routes,
						cache.arn,
						cache.orderedCacheBehaviors,
						cache.defaultCacheBehavior,
						cache.origins,
					]).apply(
						([
							routes,
							cacheArn,
							orderedCacheBehaviors,
							defaultCacheBehavior,
							origins,
						]) => {
							console.debug({
								CdnComponentAws: {
									routes,
									hostnames,
									orderedCacheBehaviors: JSON.stringify(
										orderedCacheBehaviors,
										null,
										4,
									),
									defaultCacheBehavior: JSON.stringify(
										defaultCacheBehavior,
										null,
										4,
									),
									origins: JSON.stringify(origins, null, 4),
								},
							});

							return Object.entries(routes).flatMap(([, routes]) =>
								Object.entries(routes)
									.filter(([, { lambdaName }]) => {
										return lambdaName.startsWith("arn:aws:lambda");
									})
									.flatMap(([prefix, { lambdaName }]) => {
										const route = prefix
											.replaceAll("/", "_")
											.replaceAll("~", "-");
										const policy = new Permission(
											`${name}-Cdn-cache-${route}-role-policy`,
											{
												function: lambdaName,
												principal: `cloudfront.amazonaws.com`,
												action: "lambda:InvokeFunctionUrl",
												sourceArn: cacheArn,
											},
											{ parent: this },
										);
										return {
											policy,
										};
									}),
							);
						},
					);

			let newManifest:
				| Output<{ CdnComponent: WebsiteManifest | ComputeManifest }>
				| undefined;
			if (websiteContent !== undefined) {
				newManifest = all([
					props.compute?.aws.http?.manifest?.ComputeComponent,
					cache.domainName,
				]).apply(([content, domainName]) => {
					const { website } = content?.manifest.frontend ?? {};
					const { routes } = content?.manifest ?? {};
					const { isProd } = context.environment;

					if (routes !== undefined) {
						Object.values(routes).forEach((routes) => {
							Object.values(routes).forEach((route) => {
								if (!context.environment.isProd) {
									route.cdn = domainName;
								}
							});
						});
					}

					if (website !== undefined && !isProd) {
						website.cdn = domainName;
					}

					return {
						CdnComponent: {
							manifest: content?.manifest ?? {
								ok: false,
							},
						},
					};
				});

				if (renderManifest) {
					new BucketObject(
						`${name}-Cdn--bucket-object-manifest-routes`,
						{
							bucket: bucketArn ?? logs.bucket,
							key: "/.CdnComponent/manifest.json",
							acl: manifestAcl,
							content: jsonStringify(newManifest),
							contentType: "application/json",
						},
						{
							parent: this,
						},
					);
				}
			}

			let metricAlarms: MetricAlarm[] = [];
			let cdnDashboard: Dashboard | undefined = undefined;
			if (monitor !== undefined) {
				const { dashboard, alarms } = monitor;

				metricAlarms =
					alarms?.map((alarm) => {
						return new MetricAlarm(`${name}-Cdn--alarm-${alarm.name}`, alarm, {
							parent: this,
						});
					}) ?? [];
				if (dashboard) {
					cdnDashboard = new Dashboard(
						`${name}-Cdn--dashboard`,
						CdnComponentAwsDashboard(context, cache, metricAlarms),
						{ parent: this },
					);
				}
			}

			return {
				cache,
				monitor: {
					logs,
					alarms: metricAlarms,
					dashboard: cdnDashboard,
				},
				function: {
					rewriteUrls,
				},
				iam: {
					identity,
					policy: undefined,
				},
				manifest:
					newManifest !== undefined
						? {
								content: newManifest,
							}
						: undefined,
			};
		})();
	}
}
