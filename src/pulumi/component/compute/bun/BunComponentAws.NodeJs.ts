import { execSync } from "node:child_process";
import { hostname, version } from "node:os";
import { join } from "node:path";
import { LogGroup } from "@pulumi/aws/cloudwatch/logGroup.js";
import type { Vpc } from "@pulumi/aws/ec2/index.js";
import { ManagedPolicy } from "@pulumi/aws/iam/index.js";
import type { Role } from "@pulumi/aws/iam/role.js";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment.js";
import {
	FunctionUrl,
	type FunctionUrlArgs,
} from "@pulumi/aws/lambda/functionUrl.js";
import {
	Function as LambdaFunction,
	Runtime,
} from "@pulumi/aws/lambda/index.js";
import { BucketObject, BucketV2 } from "@pulumi/aws/s3/index.js";
import { Instance, Service } from "@pulumi/aws/servicediscovery/index.js";
import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery/privateDnsNamespace.js";
import { Image } from "@pulumi/docker-build/index.js";
import { AssetArchive, FileArchive } from "@pulumi/pulumi/asset/index.js";
import {
	type ComponentResourceOptions,
	type Output,
	all,
	interpolate,
} from "@pulumi/pulumi/index.js";
import { AwsDockerImage } from "../../aws/AwsDockerImage.js";
import type {
	LambdaRouteResource,
	RouteMap,
} from "../../website/WebsiteManifest.js";
import {
	ComputeComponent,
	type ComputeComponentProps,
} from "../ComputeComponent.js";
import { ComputeDockerImage } from "../ComputeDockerImage.js";
import type { ComputeManifest } from "../ComputeManifest.js";
import type { BunArtifactLayer } from "./BunArtifactLayer.js";
import {
	BunComponentAwsAssets,
	type BunComponentAwsAssetsState,
} from "./aws/BunComponentAwsAssets.js";

export interface BunComponentAwsNodeProps
	extends Omit<ComputeComponentProps, "build"> {
	artifact: BunArtifactLayer;
	role: Role;
	vpc?: Vpc;
	timeout?: number;
	environment?: { [key: string]: string };
	functionUrl?: boolean;
	routes?: Output<RouteMap<LambdaRouteResource>>;
	handler: string;
	callback?: string;
	assetPath?: string;
	buildPath?: string;
	publicPath?: string;
}

export type BunComponentAwsNodeState = {
	lambda: LambdaFunction;
	cloudmap?: {
		namespace: PrivateDnsNamespace;
		service: Service;
		instance: Instance;
	};
	monitor: {
		logs: LogGroup;
	};
	http?: {
		url: FunctionUrl;
		manifest?: Output<{ ComputeComponent: ComputeManifest }>;
	};
	assets?: BunComponentAwsAssetsState;
};

export class BunComponentAwsNode extends ComputeComponent {
	static readonly URN = "compute:aws::bun";
	public readonly aws: BunComponentAwsNodeState;

	constructor(
		name: string,
		props: BunComponentAwsNodeProps,
		opts?: ComponentResourceOptions,
	) {
		super(BunComponentAwsNode.URN, name, { ...props }, opts);

		const {
			context,
			role,
			memorySize = "256",
			timeout = 14,
			envs,
			artifact,
			functionUrl,
			routes,
			handler,
			callback = "fetch",
			assetPath,
			buildPath = "build",
			publicPath = "assets",
			vpc,
		} = props;

		const { root, buildId } = artifact.current.initialized;
		const { hash } = artifact.current;
		const logGroup = new LogGroup(
			`${name}-logGroup`,
			{
				retentionInDays: 365,
			},
			{ parent: this },
		);

		const from = "appbuild";
		const artifactRoot = all([buildId]).apply(([buildId]) => {
			const tempContextPath = join(
				process.cwd(),
				"build",
				"aws",
				"image",
				"compute",
				"bunjs",
				buildId,
			);
			return ((path) => {
				execSync(`mkdir -p ${path}/function`);
				return path;
			})(tempContextPath);
		});
		const image = new Image(
			`$${name}-Image`,
			{
				buildOnPreview: false,
				context: {
					location: artifact.current.initialized.root,
				},
				dockerfile: {
					inline: interpolate`
					${artifact.inline}
					FROM ${AwsDockerImage.BASE_IMAGE} AS bootstrap
					${ComputeDockerImage.copy(from, "")}				
					WORKDIR /function
					COPY --from=${from} /artifact/appbuild/${buildPath} /function/code
					`,
				},
				exports: [
					{
						local: {
							dest: artifactRoot,
						},
					},
				],
				platforms: ["linux/arm64"],
				push: false,
			},
			{
				parent: this,
				dependsOn: [logGroup],
			},
		);

		const bucket = new BucketV2(
			`${name}-Bun--code-bucket`,
			{},
			{ parent: this },
		);

		if (`${name}-Bun-js-lambda`.length > 64 - 8) {
			const combined = `${name}-Bun-js-lambda`;
			throw new Error(
				`Combined name of lambda too long: ${combined} (${combined.length})`,
			);
		}

		// TODO: Layer lambda runtime and share across all BunComponentAwsNode instances
		const zip = new BucketObject(
			`${name}-Bun--code-bucket--zip`,
			{
				bucket: bucket.bucket,
				key: all([buildId]).apply(([buildId]) => {
					return `${name}_${buildId}_bun.zip`;
				}),
				source: all([root, hash, artifactRoot]).apply(
					([root, hash, artifactRoot]) => {
						console.debug({
							BunComponentAwsNode: {
								root,
								hash,
								artifactRoot,
							},
						});
						return new AssetArchive({
							".": new FileArchive(`${artifactRoot}/function`),
						});
					},
				),
			},
			{
				parent: this,
				dependsOn: [image],
				deleteBeforeReplace: true,
			},
		);

		let manifestContent:
			| Output<{ ComputeComponent: ComputeManifest }>
			| undefined;

		if (routes) {
			manifestContent = all([routes]).apply(([routes]) => {
				const { environment, stage, frontend } = context;
				// const { websiteEndpoint } = frontend?.website ?? {};

				console.debug({
					BunComponentAwsNode: {
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
								hostnames: frontend?.dns?.hostnames ?? [],
							},
							version: {
								sequence: Date.now().toString(),
								build: artifact.current.initialized.root.apply(
									(root) => root.split("/").pop() ?? "qwq",
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
							},
						} as const,
					},
				};
			});

			// const parameter = new Parameter(
			// 	`${name}-Bun-manifest--parameter`,
			// 	{
			// 		name: `${name}-Bun--manifest`,
			// 		type: "String",
			// 		value: data.LEAF_MANIFEST,
			// 	},
			// 	{
			// 		parent: this,
			// 	},
			// );

			// new Static(
			// 	`${name}-manifest-parameter-timestamp`,
			// 	{
			// 		triggers: {
			// 			data: data.LEAF_MANIFEST,
			// 		},
			// 	},
			// 	{
			// 		parent: parameter,
			// 		replaceOnChanges: ["*"],
			// 		deleteBeforeReplace: true,
			// 	},
			// );
		}

		const lambda = new LambdaFunction(
			`${name}-Bun-js-lambda`,
			{
				architectures: ["arm64"],
				runtime: Runtime.NodeJS20dX,
				memorySize: Number.parseInt(memorySize),
				handler: `${handler}.${callback}`,
				role: role.arn,
				s3Bucket: bucket.bucket,
				s3Key: zip.key,
				timeout,
				environment: all([envs, manifestContent]).apply(
					([env, manifestContent]) => {
						const variables = {
							LOG_LEVEL: "DEBUG",
							...env,
						};

						if (manifestContent) {
							Object.assign(variables, {
								LEAF_MANIFEST: Buffer.from(
									JSON.stringify(manifestContent),
								).toString("base64"),
							});
						}

						console.debug({
							BunComponentAwsNode: { build: artifact, variables },
						});
						return {
							variables,
						} as { variables: Record<string, string> };
					},
				),
				loggingConfig: {
					logFormat: "JSON",
					logGroup: logGroup.name,
				},
			},
			{
				parent: this,
				dependsOn: [image],
			},
		);

		let assets: BunComponentAwsAssetsState | undefined = undefined;
		if (assetPath !== undefined) {
			assets = BunComponentAwsAssets(
				`${name}-Bun-js`,
				{
					lambda,
					image,
				},
				context,
				{
					artifact,
					blockPublic: context.environment.isProd,
					wwwroot: all([root, hash, artifactRoot]).apply(
						([root, hash, artifactRoot]) => {
							console.debug({
								BunComponentAwsNodeAssets: {
									root,
									hash,
									artifactRoot,
									blockPublic: context.environment.isProd,
								},
							});
							const path = `${artifactRoot}/function/${assetPath}`;
							execSync(`mkdir -p ${path}`);
							return path;
						},
					),
					indexHtmlPath: "index.html",
					errorHtmlPath: "error.html",
					routes,
					publicPath,
				},
			);
		}

		new RolePolicyAttachment(
			`${name}-Bun-js-lambda-role-policy`,
			{
				role,
				policyArn: ManagedPolicy.AWSLambdaBasicExecutionRole,
			},
			{ parent: this },
		);

		let url: FunctionUrl | undefined = undefined;
		if (functionUrl) {
			const hosts: string[] = [];
			const hostnames: string[] =
				context?.frontend?.dns?.hostnames
					?.map((host) => [`https://${host}`, `https://www.${host}`])
					.reduce((acc, current) => [...acc, ...current], []) ?? [];

			url = new FunctionUrl(
				`${name}-Bun-js-http-url--lambda-url`,
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
								new Promise((resolve) => setTimeout(resolve, 4000)),
							]);
							// cors.promise = Promise.withResolvers();

							console.debug({
								BunComponentAwsNode: {
									build: artifact,
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
		}

		let cloudmap:
			| {
					namespace: PrivateDnsNamespace;
					service: Service;
					instance: Instance;
			  }
			| undefined = undefined;
		if (vpc !== undefined) {
			const cloudMapPrivateDnsNamespace = new PrivateDnsNamespace(
				`${name}-Bun--cloudmap-namespace`,
				{
					name: "bun",
					description: "Bun namespace",
					vpc: vpc.id,
				},
				{
					parent: this,
				},
			);

			const cloudMapService = new Service(
				`${name}-Bun--cloudmap-service`,
				{
					name: name,
					description: "Bun service",
					dnsConfig: {
						namespaceId: cloudMapPrivateDnsNamespace.id,
						routingPolicy: "MULTIVALUE",
						dnsRecords: [
							{
								type: "A",
								ttl: 300,
							},
						],
					},
				},
				{
					parent: this,
				},
			);

			//TODO Blue/Green deployment
			const cloudMapInstance = new Instance(
				`${name}-Bun--cloudmap-instance`,
				{
					instanceId: `${name}-Bun--greebo`,
					attributes: {
						"aws:lambda:service-name": "bun",
						"aws:lambda:function-name": lambda.name,
						"aws:lambda:url": url?.functionUrl ?? "",
					},
					serviceId: cloudMapService.id,
				},
				{
					parent: this,
				},
			);

			cloudmap = {
				namespace: cloudMapPrivateDnsNamespace,
				service: cloudMapService,
				instance: cloudMapInstance,
			};
		}

		const http = url ? { http: { url, manifest: manifestContent } } : {};

		this.aws = {
			lambda,
			monitor: {
				logs: logGroup,
			},
			...http,
			assets,
			cloudmap,
		};

		this.registerOutputs({
			aws: this.aws,
		});
	}
}
