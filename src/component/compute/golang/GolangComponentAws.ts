import { ManagedPolicy } from "@pulumi/aws/iam/index.js";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment.js";
import * as aws from "@pulumi/aws/index.js";
import {
	FunctionUrl,
	type FunctionUrlArgs,
} from "@pulumi/aws/lambda/functionUrl.js";
import { Function } from "@pulumi/aws/lambda/index.js";
import * as pulumi from "@pulumi/pulumi/index.js";
import { Output } from "@pulumi/pulumi/index.js";
import {
	ComputeComponent,
	type ComputeComponentProps,
} from "../ComputeComponent.js";
import type { ComputeComponentAwsState } from "../ComputeComponentAws.js";
import type { GolangComponentBuildResult } from "./GolangComponent.js";

export interface GolangComponentAwsProps
	extends Omit<ComputeComponentProps, "build"> {
	build: GolangComponentBuildResult;
	role: aws.iam.Role;
	timeout?: number;
	environment?: { [key: string]: string };
	url?: boolean;
}

export type GolangComponentAwsState = ComputeComponentAwsState;

export class GolangComponentAws extends ComputeComponent {
	static readonly URN = "compute:aws::golang";
	public readonly aws: GolangComponentAwsState;

	constructor(
		name: string,
		props: GolangComponentAwsProps,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super(GolangComponentAws.URN, name, { ...props, build: props.build }, opts);

		const {
			context,
			role,
			memorySize = "128",
			timeout = 14,
			envs,
			build,
			url: deployUrl,
		} = props;

		const logGroup = new aws.cloudwatch.LogGroup(
			`${name}-logGroup`,
			{
				retentionInDays: 365,
			},
			{ parent: this },
		);

		const { root, main } = build;

		console.debug({
			GolangComponentAws: {
				message: "Creating bootstrap artifacts",
				root,
			},
		});
		const {
			build: { artifacts },
		} = build;
		const artifact = artifacts.find((artifact) =>
			["arm64", "linux"].every((requirement) => {
				return artifact.includes(requirement);
			}),
		);
		if (!artifact) {
			throw new Error(
				`No artifact found for architecture arm64 and OS linux. \n Possible artifacts: ${artifacts.join(",")}`,
			);
		}

		const lambda = new Function(
			`${name}-lambda`,
			{
				runtime: aws.lambda.Runtime.CustomAL2023,
				architectures: ["arm64"],
				role: role.arn,
				memorySize: Number.parseInt(memorySize),
				handler: main,
				timeout,
				environment: envs?.apply((env) => {
					const variables = {
						LOG_LEVEL: "DEBUG",
						...env,
					};

					console.debug({
						GolangComponentAws: { build, variables },
					});
					return {
						variables,
					} as { variables: Record<string, string> };
				}),
				code: Output.create("").apply(() => {
					return new pulumi.asset.AssetArchive({
						bootstrap: new pulumi.asset.FileAsset(`${root}/${artifact}`),
					});
				}),
				loggingConfig: {
					logFormat: "JSON",
					logGroup: logGroup.name,
				},
			},
			{ parent: this },
		);

		new RolePolicyAttachment(
			`${name}-Golang--lambda-role-policy`,
			{
				role,
				policyArn: ManagedPolicy.AWSLambdaBasicExecutionRole,
			},
			{ parent: this },
		);

		let url: FunctionUrl | undefined = undefined;
		if (deployUrl) {
			const hosts: string[] = [];
			const hostnames: string[] =
				context?.frontend?.dns?.hostnames
					?.map((host) => [`https://${host}`, `https://www.${host}`])
					.reduce((acc, current) => [...acc, ...current], []) ?? [];

			url = new FunctionUrl(
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
								new Promise((resolve) => setTimeout(resolve, 4000)),
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
		}

		const http = url ? { http: { url } } : {};

		this.aws = {
			lambda,
			monitor: {
				logs: logGroup,
			},
			...http,
		};

		this.registerOutputs({
			aws: this.aws,
		});
	}
}
