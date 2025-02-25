import { inspect } from "node:util";
import {
	CodeBuildBuildspecBuilder,
	CodeBuildBuildspecEnvBuilder,
	CodeBuildBuildspecResourceLambdaPhaseBuilder,
} from "@levicape/fourtwo-builders";
import { Context } from "@levicape/fourtwo-pulumi";
import { Function as CloudfrontFunction } from "@pulumi/aws/cloudfront";
import { Distribution } from "@pulumi/aws/cloudfront/distribution";
import { OriginAccessIdentity } from "@pulumi/aws/cloudfront/originAccessIdentity";
import { Project } from "@pulumi/aws/codebuild";
import { getRole } from "@pulumi/aws/iam/getRole";
import { Permission } from "@pulumi/aws/lambda";
import { Bucket } from "@pulumi/aws/s3/bucket";
import { BucketAclV2 } from "@pulumi/aws/s3/bucketAclV2";
import { BucketLifecycleConfigurationV2 } from "@pulumi/aws/s3/bucketLifecycleConfigurationV2";
import { BucketObjectv2 } from "@pulumi/aws/s3/bucketObjectv2";
import { BucketOwnershipControls } from "@pulumi/aws/s3/bucketOwnershipControls";
import { BucketPublicAccessBlock } from "@pulumi/aws/s3/bucketPublicAccessBlock";
import { BucketServerSideEncryptionConfigurationV2 } from "@pulumi/aws/s3/bucketServerSideEncryptionConfigurationV2";
import { BucketVersioningV2 } from "@pulumi/aws/s3/bucketVersioningV2";
import { CannedAcl } from "@pulumi/aws/types/enums/s3";
import { Command } from "@pulumi/command/local";
import { Output, all, interpolate } from "@pulumi/pulumi";
import { warn } from "@pulumi/pulumi/log";
import { VError } from "verror";
import { stringify } from "yaml";
import type { z } from "zod";
import {
	AwsCloudfrontCachePolicy,
	AwsCloudfrontRequestPolicy,
} from "../../../Cloudfront";
import { AwsCodeBuildContainerRoundRobin } from "../../../RoundRobin";
import { $deref, type DereferencedOutput } from "../../../Stack";
import { FourtwoApplicationStackExportsZod } from "../../../application/exports";
import { FourtwoPanelHttpStackExportsZod } from "../http/exports";
import { FourtwoPanelWebStackExportsZod } from "../web/exports";
import { FourtwoPanelWWWRootExportsZod } from "./exports";

const WORKSPACE_PACKAGE_NAME = "@levicape/fourtwo";
//

const ROUTE_MAP = ({
	"panel-http": panel_http,
	"panel-web": panel_web,
}: DereferencedOutput<typeof STACKREF_CONFIG>[typeof STACKREF_ROOT]) => {
	return {
		...panel_http.routemap,
		...panel_web.routemap,
	};
};

const CI = {
	CI_ENVIRONMENT: process.env.CI_ENVIRONMENT ?? "unknown",
	CI_ACCESS_ROLE: process.env.CI_ACCESS_ROLE ?? "FourtwoAccessRole",
};

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? "fourtwo";
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		application: {
			refs: {
				servicecatalog:
					FourtwoApplicationStackExportsZod.shape
						.fourtwo_application_servicecatalog,
			},
		},
		["panel-http"]: {
			refs: {
				cloudmap:
					FourtwoPanelHttpStackExportsZod.shape.fourtwo_panel_http_cloudmap,
				routemap:
					FourtwoPanelHttpStackExportsZod.shape.fourtwo_panel_http_routemap,
			},
		},
		["panel-web"]: {
			refs: {
				s3: FourtwoPanelWebStackExportsZod.shape.fourtwo_panel_web_s3,
				routemap:
					FourtwoPanelWebStackExportsZod.shape.fourtwo_panel_web_routemap,
			},
		},
	},
} as const;

export = async () => {
	// Stack references
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const routes = ROUTE_MAP(dereferenced$);

	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name?: string) =>
		name ? `${context.prefix}-${name}` : context.prefix;
	context.resourcegroups({ _ });

	const farRole = await getRole({ name: CI.CI_ACCESS_ROLE });

	////////
	// Origins
	//
	const origins = (() => {
		return Object.entries(routes).flatMap(([prefix, route]) => {
			const { hostname, $kind } = route;
			if (hostname?.startsWith("http")) {
				warn(
					inspect(
						{
							WWWRoot: {
								message:
									"!!!!!!!!! WARNING !!!!!!!!!\n Urls should not start with http or https. This will fail resource creation",
								hostname,
							},
						},
						{ depth: null },
					),
				);
			}

			const domainName = `${hostname?.at(-1) !== "/" ? hostname : hostname?.slice(0, hostname?.length - 1)}`;
			if (prefix === "/") {
				switch ($kind) {
					case "LambdaRouteResource":
						return [
							{
								originId: "default__origin__compute",
								domainName,
								prefix: "",
							},
							// {
							// 	originId: "default__origin__assets",
							// 	domainName,
							// 	prefix: "",
							// },
						];
					case "S3RouteResource":
						return [
							{
								originId: route.bucket.domainName,
								domainName: route.bucket.domainName,
								prefix: "",
								s3: true,
							},
							{
								originId: "default__origin__assets",
								domainName,
								prefix: "",
							},
						];
					default:
						throw new VError(
							`Route ${prefix} is not a LambdaRouteResource or S3RouteResource`,
						);
				}
			}

			return {
				originId: prefix.replaceAll("/", "_"),
				domainName,
				prefix,
				s3: $kind === "S3RouteResource",
			};
		});
	})();

	if (
		origins.filter((o) => o.originId === "default__origin__compute").length > 1
	) {
		throw new VError(
			`More than one origin with id default__origin__compute. Please verify your route map`,
		);
	}

	if (
		origins.filter((o) => o.originId === "default__origin__assets").length > 1
	) {
		throw new VError(
			`More than one origin with id default__origin__assets. Please verify your route map`,
		);
	}

	////////
	// Cloudfront Functions
	//////
	//// Rewrite URLs
	//
	const rewriteUrls = new CloudfrontFunction(_("rewrite-url"), {
		runtime: "cloudfront-js-2.0",
		comment: `Rewrite URLs for ${context.prefix}. Paths ending with / or without a file extension will be rewritten to /index.html`,
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
	});

	if (_(`rewrite-url`).length > 64 - 8) {
		const combined = `${_(`rewrite-url`)}`;
		throw new VError(
			`Combined name of function too long: ${combined} (${combined.length})`,
		);
	}
	//

	//////
	//// Host header injection
	//
	const hostHeaderInjection = new CloudfrontFunction(_("host-header"), {
		runtime: "cloudfront-js-2.0",
		comment: `Host header injection for ${context.prefix}. This function is used to inject the host header into the request. This is useful for S3 origins.`,
		code: `
function handler(event) {
  event.request.uri = event.request.uri.split('/').map(encodeURIComponent).join('/');
  event.request.headers["x-forwarded-host"] = event.request.headers.host;
  return event.request;
}
	  `,
	});

	if (_(`host-header`).length > 64 - 8) {
		const combined = `${_(`host-header`)}`;
		throw new VError(
			`Combined name of lambda too long: ${combined} (${combined.length})`,
		);
	}
	//

	////////
	// S3
	//////
	//
	const s3 = (() => {
		const bucket = (
			name: string,
			props: {
				daysToRetain?: number;
				ownership?: "BucketOwnerPreferred";
			} = {
				daysToRetain: context.environment.isProd ? 30 : 8,
				ownership: undefined,
			},
		) => {
			const { daysToRetain, ownership } = props;
			const bucket = new Bucket(_(name), {
				acl: "private",
				forceDestroy: !context.environment.isProd,
				tags: {
					Name: _(name),
					StackRef: STACKREF_ROOT,
					WORKSPACE_PACKAGE_NAME,
					Key: name,
				},
			});

			new BucketServerSideEncryptionConfigurationV2(_(`${name}-encryption`), {
				bucket: bucket.bucket,
				rules: [
					{
						applyServerSideEncryptionByDefault: {
							sseAlgorithm: "AES256",
						},
					},
				],
			});
			new BucketVersioningV2(_(`${name}-versioning`), {
				bucket: bucket.bucket,
				versioningConfiguration: {
					status: "Enabled",
				},
			});

			let acl: undefined | BucketAclV2;
			if (ownership) {
				const ownership = new BucketOwnershipControls(_("logs-ownership"), {
					bucket: bucket.bucket,
					rule: {
						objectOwnership: "BucketOwnerPreferred",
					},
				});
				acl = new BucketAclV2(
					_("logs-acl"),
					{
						bucket: bucket.bucket,
						acl: CannedAcl.Private,
					},
					{ dependsOn: ownership },
				);
			} else {
				new BucketPublicAccessBlock(
					_(`${name}-public-access`),
					{
						bucket: bucket.bucket,
						blockPublicAcls: true,
						blockPublicPolicy: true,
						ignorePublicAcls: true,
						restrictPublicBuckets: true,
					},
					{
						dependsOn: [bucket],
						replaceOnChanges: ["*"],
						deleteBeforeReplace: true,
					},
				);
			}

			if (daysToRetain) {
				new BucketLifecycleConfigurationV2(_(`${name}-lifecycle`), {
					bucket: bucket.bucket,
					rules: [
						{
							status: "Enabled",
							id: "DeleteMarkers",
							expiration: {
								expiredObjectDeleteMarker: true,
							},
						},
						{
							status: "Enabled",
							id: "IncompleteMultipartUploads",
							abortIncompleteMultipartUpload: {
								daysAfterInitiation: context.environment.isProd ? 3 : 7,
							},
						},
						{
							status: "Enabled",
							id: "NonCurrentVersions",
							noncurrentVersionExpiration: {
								noncurrentDays: context.environment.isProd ? 13 : 6,
							},
							filter: {
								objectSizeGreaterThan: 1,
							},
						},
						{
							status: "Enabled",
							id: "ExpireObjects",
							expiration: {
								days: context.environment.isProd ? 20 : 10,
							},
							filter: {
								objectSizeGreaterThan: 1,
							},
						},
					],
				});
			}

			return {
				acl,
				bucket,
				region: bucket.region,
			};
		};
		return {
			artifacts: bucket("artifacts"),
			logs: bucket("logs", {
				daysToRetain: context.environment.isProd ? 30 : 8,
				ownership: "BucketOwnerPreferred",
			}),
		};
	})();
	//

	////////
	// TLS
	//////
	//// Certificate
	// TODO: stackref, application stack should set up root dns delegation. Include R53 resources and provision certificate in wwwtls stack
	let certificate: undefined | { arn: string } = undefined as unknown as {
		arn: string;
	};
	//

	////////
	// CDN
	//////
	//
	// const hostnames = context.frontend?.dns?.hostnames ?? [];
	const identity = new OriginAccessIdentity(_("oai"), {
		comment: `OAI for ${context.prefix}`,
	});
	const isCompute =
		origins.filter((o) => o.originId === "default__origin__compute").length > 0;
	const defaultOriginDomain = origins.find(
		(o) => o.prefix === "" && o.s3,
	)?.domainName;
	const cache = new Distribution(
		_("cdn"),
		{
			enabled: true,
			comment: `CDN for ${context.prefix}`,
			httpVersion: "http2and3",
			priceClass: "PriceClass_100",
			isIpv6Enabled: true,
			// aliases: hostnames
			// 	?.filter((hostname) => {
			// 		return hostname !== "localhost";
			// 	})
			// 	.flatMap((hostname) => [hostname, `www.${hostname}`]),
			...(certificate
				? {
						viewerCertificate: {
							acmCertificateArn: certificate?.arn,
							cloudfrontDefaultCertificate: !context.environment.isProd,
						},
					}
				: {
						viewerCertificate: {
							cloudfrontDefaultCertificate: true,
						},
					}),
			origins:
				origins === undefined
					? []
					: all([origins, identity.cloudfrontAccessIdentityPath]).apply(
							([origins, cloudfrontAccessIdentityPath]) => {
								const applied = [
									...origins
										.filter(({ originId }) => {
											return originId === defaultOriginDomain;
										})
										.map(({ originId, domainName }) => ({
											originId,
											domainName,
											s3OriginConfig: {
												originAccessIdentity: cloudfrontAccessIdentityPath,
											},
										})),
									...origins
										.filter(({ originId }) => {
											return originId !== defaultOriginDomain;
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
								return applied;
							},
						),
			defaultCacheBehavior: {
				cachePolicyId: isCompute
					? AwsCloudfrontCachePolicy.DISABLED
					: AwsCloudfrontCachePolicy.OPTIMIZED,
				targetOriginId: isCompute
					? "default__origin__compute"
					: (defaultOriginDomain ?? ""),
				functionAssociations: [
					{
						functionArn: isCompute ? hostHeaderInjection.arn : rewriteUrls.arn,
						eventType: "viewer-request",
					},
				],
				viewerProtocolPolicy: "redirect-to-https",
				allowedMethods: isCompute
					? ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
					: ["HEAD", "GET", "OPTIONS"],
				cachedMethods: ["HEAD", "GET", "OPTIONS"],
				compress: true,
				originRequestPolicyId: isCompute
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
										originId !== defaultOriginDomain &&
										originId !== "default__origin__compute"
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
							return allorigins;
						}),
			loggingConfig: {
				bucket: s3.logs.bucket.bucketDomainName,
				includeCookies: false,
				prefix: "",
			},
			restrictions: {
				geoRestriction: {
					restrictionType: "none",
				},
			},
		},
		{ dependsOn: [...(s3.logs.acl ? [s3.logs.acl] : [])] },
	);

	//////
	//// Lambda permissions
	routes === undefined
		? []
		: all([cache.arn]).apply(([cacheArn]) => {
				return Object.entries(routes)
					.filter(([, route]) => {
						return (
							route.$kind === "LambdaRouteResource" &&
							route.lambda.arn.startsWith("arn:aws:lambda")
						);
					})
					.flatMap(([prefix, route]) => {
						if (route.$kind !== "LambdaRouteResource") {
							throw new VError(`Route ${prefix} is not a LambdaRouteResource`);
						}
						const routeKey = prefix.replaceAll("/", "_").replaceAll("~", "-");

						const policy = new Permission(_(routeKey), {
							function: route.lambda.arn,
							principal: `cloudfront.amazonaws.com`,
							action: "lambda:InvokeFunctionUrl",
							sourceArn: cacheArn,
						});
						return {
							policy,
						};
					});
			});

	//

	////////
	// Codebuild
	//////
	//// Cache Invalidation
	//

	const codebuild = (() => {
		const deployStage = "wwwroot";
		const deployAction = "invalidate-cache";
		const artifactIdentifier = `${deployStage}_${deployAction}`;

		const buildspec = (() => {
			const content = stringify(
				new CodeBuildBuildspecBuilder()
					.setVersion("0.2")
					.setEnv(
						new CodeBuildBuildspecEnvBuilder().setVariables({
							CLOUDFRONT_DISTRIBUTION_ID: `<CLOUDFRONT_DISTRIBUTION_ID>`,
						}),
					)
					.setPhases({
						build:
							new CodeBuildBuildspecResourceLambdaPhaseBuilder().setCommands([
								"env",
								"aws --version",
								"aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'",
								"echo 'Cache invalidation initiated.'",
							]),
					})
					.build(),
			);

			const upload = new BucketObjectv2(_("buildspec-upload"), {
				bucket: s3.artifacts.bucket.bucket,
				content,
				key: "Buildspec.yml",
			});

			return {
				content,
				upload,
			};
		})();

		const project = (() => {
			const project = new Project(
				_(artifactIdentifier),
				{
					description: `(${WORKSPACE_PACKAGE_NAME}) Pipeline "${deployStage}" stage: "${deployAction}"`,
					buildTimeout: 14,
					serviceRole: farRole.arn,
					artifacts: {
						type: "NO_ARTIFACTS",
					},
					environment: {
						type: "ARM_CONTAINER",
						computeType: AwsCodeBuildContainerRoundRobin.next().value,
						image: "aws/codebuild/amazonlinux-aarch64-standard:3.0",
						environmentVariables: [
							{
								name: "CLOUDFRONT_DISTRIBUTION_ID",
								value: cache.id,
								type: "PLAINTEXT",
							},
						],
					},
					source: {
						type: "NO_SOURCE",
						buildspec: buildspec.content,
					},
					tags: {
						Name: _(artifactIdentifier),
						StackRef: STACKREF_ROOT,
						WORKSPACE_PACKAGE_NAME,
						DeployStage: deployStage,
						Action: deployAction,
					},
				},
				{
					dependsOn: [buildspec.upload, s3.artifacts.bucket],
				},
			);

			return {
				project,
			};
		})();

		return {
			...project,
			spec: {
				artifactIdentifier,
				buildspec,
			},
		};
	})();
	//////
	//// Trigger Codebuild project
	new Command(
		_("invalidate-command"),
		{
			create: interpolate`aws codebuild start-build --project-name ${codebuild.project.name}`,
		},
		{
			deleteBeforeReplace: true,
			replaceOnChanges: ["*"],
			dependsOn: [codebuild.project, codebuild.spec.buildspec.upload, cache],
		},
	);
	//

	////////
	//// Outputs
	/////
	const s3Output = Output.create(
		Object.fromEntries(
			Object.entries(s3).map(([key, bucket]) => {
				return [
					key,
					all([bucket.bucket, bucket.region]).apply(
						([bucketName, bucketRegion]) => ({
							bucket: bucketName,
							region: bucketRegion,
						}),
					),
				];
			}) as [],
		) as Record<keyof typeof s3, Output<{ bucket: string; region: string }>>,
	);

	const cloudfrontOutput = Output.create({
		distribution: {
			arn: cache.arn,
			id: cache.id,
			domainName: cache.domainName,
			status: cache.status,
			aliases: cache.aliases,
			originAccessIdentity: identity.cloudfrontAccessIdentityPath,
			etag: cache.etag,
			lastModifiedTime: cache.lastModifiedTime,
			origins: cache.origins,
			defaultCacheBehavior: cache.defaultCacheBehavior,
			orderedCacheBehaviors: cache.orderedCacheBehaviors,
			customErrorResponses: cache.customErrorResponses,
			restrictions: cache.restrictions,
			viewerCertificate: cache.viewerCertificate,
			loggingConfig: cache.loggingConfig,
		},
	}).apply(({ distribution }) => {
		return {
			distribution,
		};
	});

	const codebuildProjectsOutput = Output.create(
		Object.fromEntries(
			Object.entries({ invalidate: codebuild }).map(([key, resources]) => {
				return [
					key,
					all([
						resources.project.arn,
						resources.project.name,
						resources.spec.buildspec.upload.bucket,
						resources.spec.buildspec.upload.key,
					]).apply(([projectArn, projectName, bucketName, bucketKey]) => ({
						buildspec: {
							bucket: bucketName,
							key: bucketKey,
						},
						project: {
							arn: projectArn,
							name: projectName,
						},
					})),
				];
			}),
		) as Record<
			"invalidate",
			Output<{
				buildspec: { bucket: string; key: string };
				project: { arn: string; name: string };
			}>
		>,
	);

	return all([s3Output, cloudfrontOutput, codebuildProjectsOutput]).apply(
		([
			fourtwo_panel_wwwroot_s3,
			fourtwo_panel_wwwroot_cloudfront,
			fourtwo_panel_wwwroot_codebuild,
		]) => {
			const exported = {
				fourtwo_panel_wwwroot_imports: {
					fourtwo: {
						panel_http: dereferenced$["panel-http"],
						panel_web: dereferenced$["panel-web"],
					},
				},
				fourtwo_panel_wwwroot_s3,
				fourtwo_panel_wwwroot_cloudfront,
				fourtwo_panel_wwwroot_codebuild,
			} satisfies z.infer<typeof FourtwoPanelWWWRootExportsZod> & {
				fourtwo_panel_wwwroot_imports: {
					fourtwo: {
						panel_http: (typeof dereferenced$)["panel-http"];
						panel_web: (typeof dereferenced$)["panel-web"];
					};
				};
			};
			const validate = FourtwoPanelWWWRootExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}

			return exported;
		},
	);
};
