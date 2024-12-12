import { execSync } from "node:child_process";
import { hostname, version } from "node:os";
import { join } from "node:path";
import { LogGroup } from "@pulumi/aws/cloudwatch/logGroup.js";
import { ManagedPolicy } from "@pulumi/aws/iam/index.js";
import type { Role } from "@pulumi/aws/iam/role.js";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment.js";
import type { FunctionUrl } from "@pulumi/aws/lambda/functionUrl.js";
import {
	Function as LambdaFunction,
	Runtime,
} from "@pulumi/aws/lambda/index.js";
import { BucketObject, BucketV2 } from "@pulumi/aws/s3/index.js";
import type { Instance, Service } from "@pulumi/aws/servicediscovery/index.js";
import type { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery/privateDnsNamespace.js";
import type { Vpc } from "@pulumi/awsx/ec2/vpc.js";
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
import type { ComputeManifest } from "../ComputeManifest.js";
import type { BunArtifactLayer } from "./BunArtifactLayer.js";
import {
	BunComponentAwsAssets,
	type BunComponentAwsAssetsState,
} from "./aws/BunComponentAwsAssets.js";
import {
	BunComponentAwsEventRule,
	type BunComponentAwsEventRuleScheduleExpression,
	type BunComponentAwsEventRuleState,
} from "./aws/BunComponentAwsEventRule.js";
import type { FsState } from "./aws/BunComponentAwsFilesystem.js";
import { BunComponentAwsFunctionUrl } from "./aws/BunComponentAwsFunctionUrl.js";

export type BunComponentAwsProps = Omit<ComputeComponentProps, "build"> & {
	artifact: BunArtifactLayer;
	role: Role;
	timeout?: number;
	environment?: { [key: string]: string };
	functionUrl?: boolean;
	entrypoint?: string;
	routes?: Output<RouteMap<LambdaRouteResource>>;
	handler?: string;
	callback?: string;
	assetPath?: string;
	buildPath?: string;
	publicPath?: string;
	scheduleExpression?: BunComponentAwsEventRuleScheduleExpression;
} & (
		| {
				vpc?: Vpc;
				filesystem?: never;
		  }
		| {
				filesystem?: FsState;
				vpc?: never;
		  }
	);

export type BunComponentAwsState = {
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
	schedule?: BunComponentAwsEventRuleState;
	assets?: BunComponentAwsAssetsState;
};

export class BunComponentAws extends ComputeComponent {
	static readonly URN = "compute:aws::bun";
	public readonly aws: BunComponentAwsState;

	constructor(
		name: string,
		props: BunComponentAwsProps,
		opts?: ComponentResourceOptions,
	) {
		super(BunComponentAws.URN, name, { ...props }, opts);

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
			entrypoint = "lambda_arm64_http",
			filesystem,
			scheduleExpression,
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
		const entrycommand = `/artifact/${from}/build/bin/${entrypoint}`;
		const artifactRoot = all([buildId]).apply(([buildId]) => {
			const tempContextPath = join(
				process.cwd(),
				"build",
				"aws",
				"image",
				"compute",
				"bun",
				name.replaceAll(".", "--"),
				buildId,
			);
			return ((path) => {
				execSync(`mkdir -p ${path}/function`);
				return path;
			})(tempContextPath);
		});
		const awsdockerfile = new AwsDockerImage(entrycommand);
		const bootstrap = awsdockerfile.layer({ from, handler });
		console.dir({
			BunComponentAws: {
				name,
				artifact,
				bootstrap,
			},
		});
		const image = new Image(
			`${name}-Image`,
			{
				buildOnPreview: false,
				context: {
					location: artifact.current.initialized.root,
				},
				dockerfile: {
					inline: interpolate`
					${artifact.inline}
					${bootstrap}
					COPY --from=${from} /artifact/appbuild/${buildPath} /function/code/${buildPath}
					COPY --from=${from} /artifact/appbuild/build /function/code/build
					RUN rm -rf /function/code/build/bin
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

		if (`${name}-Bun--bin`.length > 63 - 8) {
			const combined = `${name}-Bun--bin`;
			throw new Error(
				`Combined name of bucket too long: ${combined} (${combined.length})`,
			);
		}
		const bucket = new BucketV2(`${name}-Bun--bin`, {}, { parent: this });

		if (`${name}-Bun--lambda`.length > 64 - 8) {
			const combined = `${name}-Bun--lambda`;
			throw new Error(
				`Combined name of lambda too long: ${combined} (${combined.length})`,
			);
		}
		// TODO: Layer lambda runtime and share across all BunComponentAws instances
		const zip = new BucketObject(
			`${name}-Bun--bin--zip`,
			{
				bucket: bucket.bucket,
				key: all([buildId]).apply(([buildId]) => {
					return `${name}_${buildId}_bun.zip`;
				}),
				source: all([root, hash, artifactRoot]).apply(
					([root, hash, artifactRoot]) => {
						console.debug({
							BunComponentAws: {
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
				deleteBeforeReplace: false,
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
					BunComponentAws: {
						name,
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
		}

		const vpc: Vpc | undefined = filesystem?.vpc ?? props.vpc;
		const lambda = new LambdaFunction(
			`${name}-Bun--lambda`,
			{
				architectures: ["arm64"],
				runtime: Runtime.CustomAL2023,
				memorySize: Number.parseInt(memorySize),
				handler: `${handler}.${callback}`,
				role: role.arn,
				s3Bucket: bucket.bucket,
				s3Key: zip.key,
				timeout,
				environment: all([envs, manifestContent]).apply(
					([env, manifestContent]) => {
						const { props } = filesystem ?? {
							props: { fileSystemConfig: undefined },
						};
						const { fileSystemConfig } = props ?? {
							fileSystemConfig: undefined,
						};
						const variables = {
							LEAF_CONTEXT: "lambda",
							LOG_LEVEL: "DEBUG",
							LEAF_MOUNT: fileSystemConfig?.localMountPath,
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
							BunComponentAws: { name, build: artifact, variables },
						});
						return {
							variables,
						} as { variables: Record<string, string> };
					},
				),
				loggingConfig: {
					logFormat: "JSON",
					logGroup: logGroup.name,
					applicationLogLevel: "DEBUG",
				},
				...(filesystem ?? { props: {} }).props,
			},
			{
				parent: this,
				dependsOn: [image],
			},
		);

		let assets: BunComponentAwsAssetsState | undefined = undefined;
		if (assetPath !== undefined) {
			assets = BunComponentAwsAssets(
				`${name}-Bun`,
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
								BunComponentAwsAssets: {
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
			`${name}-Bun--lambda-role-policy`,
			{
				role,
				policyArn: ManagedPolicy.AWSLambdaBasicExecutionRole,
			},
			{ parent: this },
		);

		let url: FunctionUrl | undefined = undefined;
		if (functionUrl) {
			const functionUrlState = BunComponentAwsFunctionUrl({
				name,
				parent: this,
				functionName: lambda.name,
				authorizationType: context.environment.isProd ? "AWS_IAM" : "NONE",
				allowOrigins:
					context?.frontend?.dns?.hostnames
						?.map((host) => [`https://${host}`, `https://www.${host}`])
						.reduce((acc, current) => [...acc, ...current], []) ?? [],
			});

			url = functionUrlState.url;
		}

		const cloudmap:
			| {
					namespace: PrivateDnsNamespace;
					service: Service;
					instance: Instance;
			  }
			| undefined = undefined;
		// if (vpc !== undefined && false === false) {
		// 	const cloudMapPrivateDnsNamespace = new PrivateDnsNamespace(
		// 		`${name}-Bun--cloudmap-namespace`,
		// 		{
		// 			name: "bun",
		// 			description: "Bun namespace",
		// 			vpc: vpc.vpcId,
		// 		},
		// 		{
		// 			parent: this,
		// 		},
		// 	);

		// 	const cloudMapService = new Service(
		// 		`${name}-Bun--cloudmap-service`,
		// 		{
		// 			name: name,
		// 			description: "Bun service",
		// 			dnsConfig: {
		// 				namespaceId: cloudMapPrivateDnsNamespace.id,
		// 				routingPolicy: "MULTIVALUE",
		// 				dnsRecords: [
		// 					{
		// 						type: "A",
		// 						ttl: 300,
		// 					},
		// 				],
		// 			},
		// 		},
		// 		{
		// 			parent: this,
		// 		},
		// 	);

		// 	//TODO Blue/Green deployment
		// 	const cloudMapInstance = new Instance(
		// 		`${name}-Bun--cloudmap-instance`,
		// 		{
		// 			instanceId: `${name}-Bun--greebo`,
		// 			attributes: {
		// 				"aws:lambda:service-name": "bun",
		// 				"aws:lambda:function-name": lambda.name,
		// 				"aws:lambda:url": url?.functionUrl ?? "",
		// 			},
		// 			serviceId: cloudMapService.id,
		// 		},
		// 		{
		// 			parent: this,
		// 		},
		// 	);

		// 	cloudmap = {
		// 		namespace: cloudMapPrivateDnsNamespace,
		// 		service: cloudMapService,
		// 		instance: cloudMapInstance,
		// 	};
		// }

		let schedule: BunComponentAwsEventRuleState | undefined;
		if (scheduleExpression) {
			schedule = BunComponentAwsEventRule({
				name,
				lambda,
				scheduleExpression,
				parent: this,
			});
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
			schedule,
		};

		this.registerOutputs({
			aws: this.aws,
		});
	}
}
