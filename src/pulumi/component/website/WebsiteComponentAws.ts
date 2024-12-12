import { hostname, networkInterfaces, version } from "node:os";
import { Dashboard, type DashboardArgs } from "@pulumi/aws/cloudwatch/index.js";
import {
	BucketObject,
	BucketOwnershipControls,
	BucketPublicAccessBlock,
	BucketV2,
	BucketWebsiteConfigurationV2,
} from "@pulumi/aws/s3/index.js";
import {
	type ComponentResourceOptions,
	type Output,
	all,
	jsonStringify,
} from "@pulumi/pulumi/index.js";
import { S3BucketFolder } from "@pulumi/synced-folder";
import {
	WebsiteComponent,
	type WebsiteComponentBuildResult,
	type WebsiteComponentProps,
} from "./WebsiteComponent.js";
import type { WebsiteManifest } from "./WebsiteManifest.js";

export interface WebsiteComponentAwsProps extends WebsiteComponentProps {
	monitor?: {
		dashboard?: DashboardArgs;
	};
}
export interface WebsiteComponentAwsState {
	bucket: BucketV2;
	website: BucketWebsiteConfigurationV2;
	manifest?: {
		bucketObject: BucketObject;
		content: Output<{ WebsiteComponent: WebsiteManifest }>;
	};
	monitor?: {
		dashboard?: Dashboard;
	};
}
export class WebsiteComponentAws extends WebsiteComponent {
	static readonly URN = "website:aws::static";
	rootOnly: boolean;
	$type = "WebsiteComponentAws";
	aws: WebsiteComponentAwsState;
	build: WebsiteComponentBuildResult;
	publicPath: string;

	constructor(
		name: string,
		props: WebsiteComponentAwsProps,
		opts?: ComponentResourceOptions,
	) {
		super(WebsiteComponentAws.URN, name, props, opts);
		const { build, context, routes, blockPublic, rootOnly, monitor } = {
			blockPublic: true,
			rootOnly: false,
			...props,
		};
		const { wwwroot, indexHtmlPath, errorHtmlPath } = build;

		//TODO:
		this.publicPath = "assets";

		this.rootOnly = rootOnly;
		this.build = build;
		this.aws = (() => {
			const bucket = new BucketV2(
				`${name}-Website--bucket`,
				{},
				{ parent: this },
			);

			const bucketName = bucket.bucket;
			const publicAccessBlock = new BucketPublicAccessBlock(
				`${name}-Website--bucket-public-access`,
				{
					bucket: bucketName,
					blockPublicAcls: blockPublic,
					blockPublicPolicy: blockPublic,
					ignorePublicAcls: blockPublic,
					restrictPublicBuckets: blockPublic,
				},
				{
					dependsOn: [bucket],
					parent: this,
				},
			);

			const ownershipControls = new BucketOwnershipControls(
				`${name}-Website--bucket-ownership`,
				{
					bucket: bucketName,
					rule: {
						objectOwnership: "ObjectWriter",
					},
				},
				{ parent: this },
			);

			const website = new BucketWebsiteConfigurationV2(
				`${name}-Website--bucket-website-configuration`,
				{
					bucket: bucketName,
					indexDocument: {
						suffix: indexHtmlPath,
					},
					errorDocument: {
						key: errorHtmlPath,
					},
				},
				{
					dependsOn: [bucket],
					parent: this,
				},
			);
			const acl = blockPublic ? "bucket-owner-full-control" : "public-read";

			const folder = new S3BucketFolder(
				`${name}-Website--bucket-folder`,
				{
					path: wwwroot,
					bucketName,
					acl,
					managedObjects: false,
				},
				{
					dependsOn: [website, ownershipControls, publicAccessBlock],
					parent: this,
				},
			);

			let content: Output<{ WebsiteComponent: WebsiteManifest }> | undefined;
			if (routes !== undefined) {
				const {
					stage,
					environment: { aws, isProd },
					frontend,
				} = context;
				const { websiteEndpoint } = website;
				content = all([routes, bucketName, websiteEndpoint]).apply(
					([routes, bucketName, url]) => {
						const { dns } = frontend ?? {};
						const { hostnames } = dns ?? {};

						console.debug({
							WebsiteComponentAws: {
								aws,
								stage,
								isProd,
								manifest: {
									bucketName,
									wwwroot,
									hostnames,
									routes: JSON.stringify(
										{
											...routes,
										},
										null,
										4,
									).replaceAll("\n", ""),
								},
							},
						});
						return {
							WebsiteComponent: {
								manifest: {
									ok: true,
									routes,
									frontend: {
										...(isProd
											? {}
											: {
													website: {
														url,
														protocol: "http",
													},
												}),
										hostnames: hostnames ?? [],
									},
									version: {
										sequence: Date.now().toString(),
										build: build.wwwroot.split("/").at(-1)!,
										stage,
										process: (() =>
											isProd
												? {}
												: {
														pid: process.pid.toString(),
														node: process.version,
														arch: process.arch,
														platform: process.platform,
														os: {
															version: version(),
															hostname: hostname(),
															mac: {
																...Object.fromEntries(
																	Object.entries(networkInterfaces()).map(
																		([key, ni]) => [key, ni?.map((i) => i.mac)],
																	),
																),
															},
														},
													})(),
										...(isProd
											? {}
											: {
													aws,
												}),
									},
								},
							} satisfies WebsiteManifest,
						};
					},
				);
			}

			if (monitor) {
				const dashboard = monitor.dashboard;
				if (dashboard) {
					new Dashboard(`${name}-Website--monitor-dashboard`, dashboard, {
						parent: this,
					});
				}
			}
			return {
				bucket,
				website,
				manifest:
					content !== undefined
						? {
								bucketObject: new BucketObject(
									`${name}-Website--bucket-object-manifest-routes`,
									{
										bucket: bucketName,
										key: "/.WebsiteComponent/manifest.json",
										acl,
										content: jsonStringify(content),
										contentType: "application/json",
									},
									{ parent: this, dependsOn: [folder] },
								),
								content,
							}
						: undefined,
			};
		})();

		this.registerOutputs({
			aws: this.aws,
		});
	}
}
