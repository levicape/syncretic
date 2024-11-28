import { hostname, version } from "node:os";
import { LogGroup } from "@pulumi/aws/cloudwatch/index.js";
import {
	ManagedPolicy,
	type Role,
	RolePolicyAttachment,
} from "@pulumi/aws/iam/index.js";
import {
	Function,
	FunctionUrl,
	type FunctionUrlArgs,
} from "@pulumi/aws/lambda/index.js";
import { BucketObject, BucketV2 } from "@pulumi/aws/s3/index.js";
import { AssetArchive, FileArchive } from "@pulumi/pulumi/asset/index.js";
import {
	type ComponentResourceOptions,
	Output,
	all,
} from "@pulumi/pulumi/index.js";
import { hashElement } from "folder-hash";
import type {
	LambdaRouteResource,
	RouteMap,
} from "../../website/WebsiteManifest.js";
import type { ComputeComponentProps } from "../ComputeComponent.js";
import type { ComputeManifest } from "../ComputeManifest.js";
import { NodejsComponent } from "./NodejsComponent.js";

export type NodejsComponentAwsState = {
	lambda: Function;
	code: {
		bucket: BucketV2;
		zip: BucketObject;
	};
	monitor: {
		logs: LogGroup;
	};
	http?: {
		url: FunctionUrl;
		manifest?: Output<{ ComputeComponent: ComputeManifest }>;
		cors: {
			add: (host: string) => void;
			promise: ReturnType<typeof Promise.withResolvers<void>>;
		};
	};
};

export interface NodejsComponentAwsProps
	extends Omit<ComputeComponentProps, "memorySize"> {
	role: Role;
	handler?: string;
	routes?: Output<RouteMap<LambdaRouteResource>>;
	memorySize?: number;
	url?: boolean;
}

export class NodejsComponentAws extends NodejsComponent {
	static readonly URN = "compute:aws::nodejs";
	public readonly aws: NodejsComponentAwsState;

	constructor(
		name: string,
		props: NodejsComponentAwsProps,
		opts?: ComponentResourceOptions,
	) {
		super(
			NodejsComponentAws.URN,
			name,
			{ ...props, memorySize: props.memorySize?.toString() },
			opts,
		);

		const {
			role,
			handler = "index.handler",
			build,
			envs,
			memorySize = 128,
			retentionInDays = 365,
			url: deployUrl = false,
			context,
			routes,
		} = props;

		const { root } = build;

		this.aws = (() => {
			const logGroup = new LogGroup(
				`${name}-Node-monitor--logGroup`,
				{
					retentionInDays,
				},
				{ parent: this },
			);

			const bucket = new BucketV2(
				`${name}-Node--code-bucket`,
				{},
				{ parent: this },
			);

			// eslint-disable-next-line prefer-const
			let [prefix, ...rest] = handler.split(".");
			while (rest.length > 1) {
				prefix += `--${rest.shift()}`;
			}
			prefix = prefix.replaceAll("/", "_");
			if (`${name}-Node--dt-${prefix}`.length > 64 - 8) {
				const combined = `${name}-Node--dt-${prefix}`;
				throw new Error(
					`Combined name of lambda too long: ${combined} (${combined.length})`,
				);
			}

			const rootId = hashElement(root, {
				algo: "sha1",
				encoding: "base64url",
				folders: {
					exclude: ["node_modules"],
				},
				files: {
					exclude: ["node_modules"],
				},
			});

			const zip = new BucketObject(
				`${name}-Node--code-bucket--zip`,
				{
					bucket: bucket.bucket,
					key: all([rootId]).apply(([result]) => {
						return `${name}_${build.buildId}_${result.hash}__nodejs__aws.zip`;
					}),
					source: all([rootId]).apply(([result]) => {
						console.debug({
							NodeJsComponentAws: {
								result,
								root,
								key: result.hash,
							},
						});
						return new AssetArchive({
							".": new FileArchive(root),
						});
					}),
				},
				{
					parent: this,
					deleteBeforeReplace: false,
				},
			);

			const lambda = new Function(
				`${name}-Node--dt-${prefix}`,
				{
					runtime: "nodejs20.x",
					architectures: ["arm64"],
					memorySize,
					handler,
					s3Bucket: bucket.bucket,
					s3Key: zip.key,
					environment: all([envs ?? {}, routes ?? {}]).apply(
						([env, routemap]) => {
							const variables = {
								LOG_LEVEL: "DEBUG",
								...env,
							};

							console.debug({
								NodeJsComponentAws: { build, handler, variables },
							});

							// (feat) flatten the routemap object
							// TODO: Render the routemap as a flat object and upload to s3
							// then pass the s3 url to the lambda function
							const routemapFlattened = Object.entries(routemap).flatMap(
								([name, value]) =>
									typeof value === "object"
										? Object.entries(value).flatMap((v) => ({
												name: `z${v[0]
													.replace(/[^a-zA-Z0-9]/g, "_")
													.toUpperCase()}`,
												value: JSON.stringify(v[1]),
											}))
										: [],
							);
							const routeMapAsObjects = routemapFlattened.map((v) => ({
								[v.name]: v.value,
							}));

							return {
								variables: {
									...variables,
									...routeMapAsObjects.reduce((acc, current) => {
										return {
											...acc,
											...current,
										};
									}, {}),
								},
							} as { variables: Record<string, string> };
						},
					),
					role: role.arn,
					loggingConfig: {
						logFormat: "JSON",
						logGroup: logGroup.name,
					},
					timeout: 6,
				},
				{ parent: this },
			);

			new RolePolicyAttachment(
				`${name}-Node--lambda-role-policy`,
				{
					role,
					policyArn: ManagedPolicy.AWSLambdaBasicExecutionRole,
				},
				{ parent: this },
			);

			if (deployUrl) {
				const hosts: string[] = [];
				const cors = {
					promise: Promise.withResolvers<void>(),
					add: (host: string) => {
						console.debug({
							NodeJsComponentAws: {
								build,
								cors: {
									host,
									hosts,
								},
							},
						});
						hosts.push(host);
					},
				};

				const hostnames: string[] =
					context?.frontend?.dns?.hostnames
						?.map((host) => [`https://${host}`, `https://www.${host}`])
						.reduce((acc, current) => [...acc, ...current], []) ?? [];

				const url = new FunctionUrl(
					`${name}-Node-http-url--lambda-url`,
					{
						functionName: lambda.name,
						authorizationType: context.environment.isProd ? "AWS_IAM" : "NONE",
						cors: {
							allowMethods: ["*"],
							allowOrigins: hostnames,
							maxAge: 86400,
						},
					},
					{
						parent: this,
						transforms: [
							async ({ props, opts }) => {
								const functionCors = (props as FunctionUrlArgs).cors;
								const allowOrigins =
									(functionCors as unknown as { allowOrigins: [] })
										?.allowOrigins ?? [];

								await Promise.any([
									cors.promise.promise,
									new Promise((resolve) => setTimeout(resolve, 8000)),
								]);

								console.debug({
									NodeJsComponentAws: {
										build,
										transform: {
											hosts: JSON.stringify(hosts),
											allowOrigins: JSON.stringify(allowOrigins),
										},
									},
								});
								return {
									props: {
										...props,
										cors: {
											...functionCors,
											allowOrigins: [...allowOrigins, ...hosts],
										},
									},
									opts,
								};
							},
						],
					},
				);

				let manifestContent:
					| Output<{ ComputeComponent: ComputeManifest }>
					| undefined;
				if (routes) {
					manifestContent = all([routes, url.functionUrl]).apply(
						([routes, url]) => {
							const { environment, stage, frontend } = context;
							// const { websiteEndpoint } = frontend?.website ?? {};

							console.debug({
								NodeJsComponentAws: {
									routes: JSON.stringify(routes, null, 4).replaceAll("\n", ""),
									// websiteEndpoint: websiteEndpoint ?? "",
								},
							});

							return {
								ComputeComponent: {
									manifest: {
										ok: true,
										routes: {
											...routes,
										},
										frontend: {
											...(environment.isProd
												? {}
												: {
														website: {
															url,
															protocol: "http" as const,
														},
													}),
											hostnames: frontend?.dns?.hostnames ?? [],
										},
										version: Output.create({
											sequence: Date.now().toString(),
											build: Output.create(
												build.root.split("/").pop() ?? "qwq",
											),
											stage,
											process: environment.isProd
												? {}
												: {
														pid: process.pid.toString(),
														node: process.version,
														arch: process.arch,
														platform: process.platform,
														os: {
															version: version(),
															hostname: hostname(),
														},
													},
											...(environment.isProd ? {} : { aws: environment.aws }),
										}),
									} as const,
								},
							};
						},
					);
				}

				return {
					lambda,
					code: {
						bucket,
						zip,
					},
					monitor: {
						logs: logGroup,
					},
					http: {
						url,
						manifest: manifestContent,
						cors,
					},
				};
			}

			return {
				lambda,
				code: {
					bucket,
					zip,
				},
				monitor: {
					logs: logGroup,
				},
			};
		})();

		this.registerOutputs({
			aws: this.aws,
		});
	}
}
