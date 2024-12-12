import { LogGroup } from "@pulumi/aws/cloudwatch/index.js";
import {
	ManagedPolicy,
	type Role,
	RolePolicyAttachment,
} from "@pulumi/aws/iam/index.js";
import {
	FunctionUrl,
	type FunctionUrlArgs,
	Function as LambdaFunction,
} from "@pulumi/aws/lambda/index.js";
import { BucketObject, BucketV2 } from "@pulumi/aws/s3/index.js";
import { AssetArchive, FileAsset } from "@pulumi/pulumi/asset/index.js";
import type { ComponentResourceOptions } from "@pulumi/pulumi/index.js";
import type { ComputeComponentProps } from "../../ComputeComponent.js";
import type { ComputeComponentAwsState } from "../../ComputeComponentAws.js";
import {
	JavaJvmComponent,
	type JavaJvmComponentBuildResult,
} from "./JavaJvmComponent.js";

type JavaJvmComponentAwsState = ComputeComponentAwsState;

export type AwsLambdaNativeRuntime =
	"io.micronaut.function.aws.runtime.APIGatewayV2HTTPEventMicronautLambdaRuntime";
export type AwsLambdaHttpHandler =
	"io.micronaut.function.aws.proxy.payload2.APIGatewayV2HTTPEventFunction";
export interface JavaJvmComponentAwsProps
	extends Omit<ComputeComponentProps, "memorySize" | "build"> {
	build: JavaJvmComponentBuildResult;
	role: Role;
	handler: AwsLambdaNativeRuntime | AwsLambdaHttpHandler | `leaf.${string}`;
	memorySize?: number;
	url?: boolean;
	timeout?: number;
}
export class JavaJvmComponentAws extends JavaJvmComponent {
	static readonly URN = "compute:aws::java";
	public readonly aws: JavaJvmComponentAwsState;

	constructor(
		name: string,
		props: JavaJvmComponentAwsProps,
		opts?: ComponentResourceOptions,
	) {
		super(
			JavaJvmComponentAws.URN,
			name,
			{ ...props, memorySize: props.memorySize?.toString() },
			opts,
		);
		const {
			role,
			handler,
			build,
			envs,
			memorySize,
			retentionInDays,
			url: deployUrl,
			context,
			timeout,
		} = {
			...{
				memorySize: 512,
				retentionInDays: 365,
				timeout: 9,
				url: false,
			},
			...props,
		};
		const { root, jarFile } = build;

		this.aws = (() => {
			const logGroup = new LogGroup(
				`${name}-Java-monitor--logGroup`,
				{
					retentionInDays,
				},
				{ parent: this },
			);

			const bucket = new BucketV2(
				`${name}-Java--code-bucket`,
				{},
				{ parent: this },
			);

			const zip = new BucketObject(
				`${name}-Java--code-bucket--zip`,
				{
					bucket: bucket.bucket,
					key: `${name}_${build.buildId}__javajvm__aws.zip`,
					source: new AssetArchive({
						[`lib/${jarFile}`]: new FileAsset(`${root}/libs/${jarFile}`),
					}),
				},
				{
					parent: this,
					deleteBeforeReplace: false,
				},
			);

			const lambda = new LambdaFunction(
				`${name}-Java--dt`,
				{
					runtime: "java21",
					architectures: ["arm64"],
					memorySize,
					handler,
					s3Bucket: bucket.bucket,
					s3Key: zip.key,
					environment: envs?.apply((env) => {
						const variables = {
							LOG_LEVEL: "DEBUG",
							...env,
						};

						console.debug({
							JavaComponentAws: { build, handler, variables },
						});
						return {
							variables,
						} as { variables: Record<string, string> };
					}),
					role: role.arn,
					loggingConfig: {
						logFormat: "JSON",
						logGroup: logGroup.name,
					},
					timeout,
				},
				{ parent: this, dependsOn: [bucket] },
			);

			new RolePolicyAttachment(
				`${name}-Java--lambda-role-policy`,
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
							JavaComponentAws: {
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
					`${name}-Java-http-url--lambda-url`,
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
								// cors.promise = Promise.withResolvers();

								console.debug({
									JavaComponentAws: {
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

				return {
					lambda,
					monitor: {
						logs: logGroup,
					},
					http: {
						url,
						cors,
					},
				};
			}

			return {
				lambda,
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
