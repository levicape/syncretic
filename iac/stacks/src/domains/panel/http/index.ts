import { inspect } from "node:util";
import {
	CodeBuildBuildspecArtifactsBuilder,
	CodeBuildBuildspecBuilder,
	CodeBuildBuildspecEnvBuilder,
	CodeBuildBuildspecResourceLambdaPhaseBuilder,
	CodeDeployAppspecBuilder,
	CodeDeployAppspecResourceBuilder,
} from "@levicape/fourtwo-builders";
import { Context } from "@levicape/fourtwo-pulumi";
import { Version } from "@pulumi/aws-native/lambda";
import { EventRule, EventTarget } from "@pulumi/aws/cloudwatch";
import { LogGroup } from "@pulumi/aws/cloudwatch/logGroup";
import { Project } from "@pulumi/aws/codebuild";
import { DeploymentGroup } from "@pulumi/aws/codedeploy/deploymentGroup";
import { Pipeline } from "@pulumi/aws/codepipeline";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { getRole } from "@pulumi/aws/iam/getRole";
import { RolePolicy } from "@pulumi/aws/iam/rolePolicy";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment";
import { Alias, Function as LambdaFn, Runtime } from "@pulumi/aws/lambda";
import { FunctionUrl } from "@pulumi/aws/lambda/functionUrl";
import {
	Bucket,
	BucketServerSideEncryptionConfigurationV2,
} from "@pulumi/aws/s3";
import { BucketLifecycleConfigurationV2 } from "@pulumi/aws/s3/bucketLifecycleConfigurationV2";
import { BucketObjectv2 } from "@pulumi/aws/s3/bucketObjectv2";
import { BucketPublicAccessBlock } from "@pulumi/aws/s3/bucketPublicAccessBlock";
import { BucketVersioningV2 } from "@pulumi/aws/s3/bucketVersioningV2";
import { Instance } from "@pulumi/aws/servicediscovery/instance";
import { Service } from "@pulumi/aws/servicediscovery/service";
import { Output, all, getStack, log } from "@pulumi/pulumi";
import { AssetArchive, StringAsset } from "@pulumi/pulumi/asset";
import { serializeError } from "serialize-error";
import { stringify } from "yaml";
import type { z } from "zod";
import { AwsCodeBuildContainerRoundRobin } from "../../../RoundRobin";
import type { LambdaRouteResource, Route } from "../../../RouteMap";
import { $deref, type DereferencedOutput } from "../../../Stack";
import { FourtwoCodestarStackExportsZod } from "../../../codestar/exports";
import { FourtwoDatalayerStackExportsZod } from "../../../datalayer/exports";
import type { WWWIntraRoute } from "../../../wwwintra/routes";
import { FourtwoPanelHttpStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo-panel-io" as const;
const DESCRIPTION = "Provides AWS account data to Panel UI" as const;
const LLRT_ARCH: string | undefined = process.env["LLRT_ARCH"]; //"lambda-arm64-full-sdk";
const LLRT_PLATFORM: "node" | "browser" | undefined = LLRT_ARCH
	? "node"
	: undefined;
const OUTPUT_DIRECTORY = `output/esbuild`;
const HANDLER = `${LLRT_ARCH ? `${OUTPUT_DIRECTORY}/${LLRT_PLATFORM}` : "module"}/http/PanelHonoApp.handler`;

const CI = {
	CI_ENVIRONMENT: process.env.CI_ENVIRONMENT ?? "unknown",
	CI_ACCESS_ROLE: process.env.CI_ACCESS_ROLE ?? "FourtwoAccessRole",
};
const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? "fourtwo";
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		codestar: {
			refs: {
				codedeploy:
					FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_codedeploy,
				ecr: FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_ecr,
			},
		},
		datalayer: {
			refs: {
				props: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_props,
				ec2: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_ec2,
				efs: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_efs,
				iam: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_iam,
				cloudmap:
					FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_cloudmap,
			},
		},
	},
};

const ENVIRONMENT = (
	$refs: DereferencedOutput<typeof STACKREF_CONFIG>[typeof STACKREF_ROOT],
) => {
	const { datalayer } = $refs;

	return {
		FOURTWO_DATALAYER_PROPS: datalayer.props,
	};
};

export = async () => {
	const context = await Context.fromConfig({});
	const _ = (name: string) => `${context.prefix}-${name}`;
	const stage = CI.CI_ENVIRONMENT;
	const farRole = await getRole({ name: CI.CI_ACCESS_ROLE });
	// Stack references
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const { codestar: __codestar, datalayer: __datalayer } = dereferenced$;

	// Object Store
	const s3 = (() => {
		const bucket = (name: string) => {
			const bucket = new Bucket(_(name), {
				acl: "private",
				forceDestroy: !context.environment.isProd,
				tags: {
					Name: _(name),
					StackRef: STACKREF_ROOT,
					PackageName: PACKAGE_NAME,
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
			new BucketVersioningV2(
				_(`${name}-versioning`),

				{
					bucket: bucket.bucket,
					versioningConfiguration: {
						status: "Enabled",
					},
				},
				{ parent: this },
			);
			new BucketPublicAccessBlock(_(`${name}-public-access-block`), {
				bucket: bucket.bucket,
				blockPublicAcls: true,
				blockPublicPolicy: true,
				ignorePublicAcls: true,
				restrictPublicBuckets: true,
			});

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

			return bucket;
		};
		return {
			pipeline: bucket("pipeline"),
			artifacts: bucket("artifacts"),
		};
	})();

	// Logging
	const cloudwatch = (() => {
		const loggroup = (name: string) => {
			const loggroup = new LogGroup(_(`${name}-logs`), {
				retentionInDays: context.environment.isProd ? 180 : 60,
				tags: {
					Name: _(`${name}-logs`),
					StackRef: STACKREF_ROOT,
					PackageName: PACKAGE_NAME,
				},
			});

			return { loggroup };
		};

		return {
			build: loggroup("build"),
			function: loggroup("function"),
		};
	})();

	// Compute
	const handler = await (async ({ datalayer, codestar }, cloudwatch) => {
		const role = datalayer.iam.roles.lambda.name;
		const roleArn = datalayer.iam.roles.lambda.arn;
		const loggroup = cloudwatch.function.loggroup;

		const lambdaPolicyDocument = all([loggroup.arn]).apply(([loggroupArn]) => {
			return {
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: [
							"ec2:CreateNetworkInterface",
							"ec2:DescribeNetworkInterfaces",
							"ec2:DeleteNetworkInterface",
						],
						Resource: "*",
					},
					{
						Effect: "Allow",
						Action: [
							"logs:CreateLogGroup",
							"logs:CreateLogStream",
							"logs:PutLogEvents",
						],
						Resource: loggroupArn,
					},
				],
			};
		});

		new RolePolicy(_("function-policy"), {
			role,
			policy: lambdaPolicyDocument.apply((lpd) => JSON.stringify(lpd)),
		});

		[
			["basic", ManagedPolicy.AWSLambdaBasicExecutionRole],
			["vpc", ManagedPolicy.AWSLambdaVPCAccessExecutionRole],
			["efs", ManagedPolicy.AmazonElasticFileSystemClientReadWriteAccess],
			["cloudmap", ManagedPolicy.AWSCloudMapDiscoverInstanceAccess],
			["s3", ManagedPolicy.AmazonS3ReadOnlyAccess],
			["ssm", ManagedPolicy.AmazonSSMReadOnlyAccess],
			["xray", ManagedPolicy.AWSXrayWriteOnlyAccess],
		].forEach(([policy, policyArn]) => {
			new RolePolicyAttachment(_(`function-policy-${policy}`), {
				role,
				policyArn,
			});
		});

		const cloudmapEnvironment = {
			AWS_CLOUDMAP_NAMESPACE_ID: datalayer.cloudmap.namespace.id,
			AWS_CLOUDMAP_NAMESPACE_NAME: datalayer.cloudmap.namespace.name,
		};

		const zip = new BucketObjectv2(_("zip"), {
			bucket: s3.artifacts.bucket,
			source: new AssetArchive({
				"index.js": new StringAsset(
					`export const handler = (${(
						// @ts-ignore
						(_event, context) => {
							const {
								functionName,
								functionVersion,
								getRemainingTimeInMillis,
								invokedFunctionArn,
								memoryLimitInMB,
								awsRequestId,
								logGroupName,
								logStreamName,
								identity,
								clientContext,
								deadline,
							} = context;

							console.log({
								functionName,
								functionVersion,
								getRemainingTimeInMillis,
								invokedFunctionArn,
								memoryLimitInMB,
								awsRequestId,
								logGroupName,
								logStreamName,
								identity,
								clientContext,
								deadline,
							});

							return {
								statusCode: 200,
								body: JSON.stringify({
									message: "Hello from Lambda!",
								}),
							};
						}
					).toString()})`,
				),
			}),
			contentType: "application/zip",
			key: "http.zip",
			tags: {
				Name: _(`zip`),
				StackRef: STACKREF_ROOT,
			},
		});

		const memorySize = context.environment.isProd ? 512 : 256;
		const timeout = context.environment.isProd ? 18 : 11;
		const lambda = new LambdaFn(
			_("function"),
			{
				description: `(${PACKAGE_NAME}) "${DESCRIPTION ?? `HTTP lambda`}" in #${stage}`,
				role: roleArn,
				architectures: ["arm64"],
				memorySize,
				timeout: timeout,
				packageType: "Zip",
				runtime: LLRT_ARCH ? Runtime.CustomAL2023 : Runtime.NodeJS22dX,
				handler: "index.handler",
				s3Bucket: s3.artifacts.bucket,
				s3Key: zip.key,
				s3ObjectVersion: zip.versionId,
				vpcConfig: {
					securityGroupIds: datalayer.props.lambda.vpcConfig.securityGroupIds,
					subnetIds: datalayer.props.lambda.vpcConfig.subnetIds,
				},
				fileSystemConfig: {
					localMountPath:
						datalayer.props.lambda.fileSystemConfig.localMountPath,
					arn: datalayer.props.lambda.fileSystemConfig.arn,
				},
				loggingConfig: {
					logFormat: "JSON",
					logGroup: loggroup.name,
					applicationLogLevel: context.environment.isProd ? "INFO" : "DEBUG",
				},
				environment: all([cloudmapEnvironment]).apply(([cloudmapEnv]) => {
					return {
						variables: {
							NODE_OPTIONS: [
								"--no-force-async-hooks-checks",
								"--enable-source-maps",
							].join(" "),
							NODE_ENV: "production",
							LOG_LEVEL: "5",
							...(LLRT_PLATFORM
								? {
										LLRT_PLATFORM,
										LLRT_GC_THRESHOLD_MB: String(memorySize / 4),
									}
								: {}),
							...cloudmapEnv,
							...(ENVIRONMENT !== undefined && typeof ENVIRONMENT === "function"
								? Object.fromEntries(
										Object.entries(ENVIRONMENT(dereferenced$))
											.filter(([_, value]) => value !== undefined)
											.filter(
												([_, value]) =>
													typeof value !== "function" &&
													typeof value !== "symbol",
											)
											.map(([key, value]) => {
												log.debug(
													inspect({
														LambdaFn: {
															environment: {
																key,
																value,
															},
														},
													}),
												);

												if (typeof value === "object") {
													return [
														key,
														Buffer.from(JSON.stringify(value)).toString(
															"base64",
														),
													];
												}
												try {
													return [key, String(value)];
												} catch (e) {
													log.warn(
														inspect(
															{
																LambdaFn: {
																	environment: {
																		key,
																		value,
																		error: serializeError(e),
																	},
																},
															},
															{ depth: null },
														),
													);
													return [key, undefined];
												}
											}),
									)
								: {}),
						},
					};
				}),
				tags: {
					Name: _("function"),
					StackRef: STACKREF_ROOT,
					Handler: "Http",
					PackageName: PACKAGE_NAME,
				},
			},
			{
				dependsOn: [zip],
				ignoreChanges: ["handler", "s3Bucket", "s3Key", "s3ObjectVersion"],
			},
		);

		const hostnames: string[] =
			context?.frontend?.dns?.hostnames
				?.map((host) => [`https://${host}`, `https://www.${host}`])
				.reduce((acc, current) => [...acc, ...current], []) ?? [];

		const version = new Version(_("version"), {
			description: `(${PACKAGE_NAME}) version for "${stage}"`,
			functionName: lambda.name,
		});

		const alias = new Alias(
			_("alias"),
			{
				description: `(${PACKAGE_NAME}) alias`,
				name: stage,
				functionName: lambda.name,
				functionVersion: version.version,
			},
			{
				ignoreChanges: ["functionVersion"],
			},
		);

		const url = new FunctionUrl(_("url"), {
			functionName: lambda.name,
			qualifier: alias.name,
			authorizationType: context.environment.isProd ? "AWS_IAM" : "NONE",
			cors: {
				allowMethods: ["*"],
				allowOrigins: context.environment.isProd ? hostnames : ["*"],
				maxAge: 86400,
			},
		});

		let latestUrl: FunctionUrl | undefined;
		if (!context.environment.isProd) {
			latestUrl = new FunctionUrl(_("url-latest"), {
				functionName: lambda.name,
				authorizationType: context.environment.isProd ? "AWS_IAM" : "NONE",
				cors: {
					allowMethods: ["*"],
					allowOrigins: hostnames,
					maxAge: 86400,
				},
			});
		}

		const deploymentGroup = new DeploymentGroup(
			_("deployment-group"),
			{
				deploymentGroupName: lambda.arn.apply((arn) =>
					_(`deploybg-${arn.slice(-10)}`),
				),
				serviceRoleArn: farRole.arn,
				appName: codestar.codedeploy.application.name,
				deploymentConfigName: codestar.codedeploy.deploymentConfig.name,
				deploymentStyle: {
					deploymentOption: "WITH_TRAFFIC_CONTROL",
					deploymentType: "BLUE_GREEN",
				},
				tags: {
					Name: _("deployment-group"),
					StackRef: STACKREF_ROOT,
					PackageName: PACKAGE_NAME,
					Kind: "HttpHandler",
					LambdaArn: lambda.arn,
					LambdaFunction: lambda.name,
					LambdaAlias: alias.name,
					LambdaVersion: version.version,
					LambdaUrl: url.functionUrl,
				},
			},
			{
				deleteBeforeReplace: true,
				dependsOn: [alias, url],
				replaceOnChanges: [
					"appName",
					"deploymentConfigName",
					"deploymentStyle",
				],
			},
		);

		return {
			role: datalayer.props.lambda.role,
			http: {
				arn: lambda.arn,
				name: lambda.name,
				url: url.functionUrl,
				qualifier: url.qualifier,
				alias,
				version,
				$latest: latestUrl,
			},
			codedeploy: {
				deploymentGroup,
			},
		};
	})({ codestar: __codestar, datalayer: __datalayer }, cloudwatch);

	// Cloudmap
	const cloudmap = (({ datalayer: { cloudmap } }) => {
		const { namespace } = cloudmap;
		const cloudMapService = new Service(_("service"), {
			name: handler.http.name.apply((name) => _(`service-${name.slice(-10)}`)),
			description: `(${PACKAGE_NAME}) "${DESCRIPTION}" in #${stage}`,
			dnsConfig: {
				namespaceId: namespace.id,
				routingPolicy: "WEIGHTED",
				dnsRecords: [
					{
						type: "CNAME",
						ttl: context.environment.isProd ? 55 : 175,
					},
				],
			},
			tags: {
				Name: _("service"),
				StackRef: STACKREF_ROOT,
				PackageName: PACKAGE_NAME,
			},
		});

		const cloudMapInstance = new Instance(_("instance"), {
			serviceId: cloudMapService.id,
			instanceId: _("instance"),
			attributes: {
				AWS_INSTANCE_CNAME: handler.http.url,
				LAMBDA_FUNCTION_ARN: handler.http.arn,
				STACK_NAME: getStack(),
				STACKREF_ROOT,
				CONTEXT_PREFIX: context.prefix,
				CI_ENVIRONMENT: stage,
				PACKAGE_NAME,
			},
		});

		return {
			service: cloudMapService,
			instance: cloudMapInstance,
		};
	})({ datalayer: __datalayer });

	const codebuild = (() => {
		const appspec = (props: {
			name: string;
			alias: string;
			currentVersion: string;
			targetVersion: string;
		}) => {
			const content = stringify(
				new CodeDeployAppspecBuilder()
					.setResources([
						{
							httphandler: new CodeDeployAppspecResourceBuilder()
								.setName(props.name)
								.setAlias(props.alias)
								// .setDescription()
								.setCurrentVersion(props.currentVersion)
								.setTargetVersion(props.targetVersion),
						},
					])
					.build(),
			);
			return {
				content,
			};
		};

		const project = (() => {
			const PIPELINE_STAGE = "httphandler" as const;
			const EXTRACT_ACTION = "extractimage" as const;
			const UPDATE_ACTION = "updatelambda" as const;

			const stages = [
				{
					stage: PIPELINE_STAGE,
					action: EXTRACT_ACTION,
					artifact: {
						name: `${PIPELINE_STAGE}_${EXTRACT_ACTION}`,
						baseDirectory: `.${EXTRACT_ACTION}` as string | undefined,
						files: ["**/*"] as string[],
					},
					variables: {
						STACKREF_CODESTAR_ECR_REPOSITORY_ARN:
							"<STACKREF_CODESTAR_ECR_REPOSITORY_ARN>",
						STACKREF_CODESTAR_ECR_REPOSITORY_NAME:
							"<STACKREF_CODESTAR_ECR_REPOSITORY_NAME>",
						STACKREF_CODESTAR_ECR_REPOSITORY_URL:
							"<STACKREF_CODESTAR_ECR_REPOSITORY_URL>",
						SOURCE_IMAGE_REPOSITORY: "<SOURCE_IMAGE_REPOSITORY>",
						SOURCE_IMAGE_URI: "<SOURCE_IMAGE_URI>",
						S3_DEPLOY_BUCKET: "<S3_DEPLOY_BUCKET>",
						S3_DEPLOY_KEY: "<S3_DEPLOY_KEY>",
					},
					exportedVariables: [
						"STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
						"STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
						"STACKREF_CODESTAR_ECR_REPOSITORY_URL",
						"S3_DEPLOY_BUCKET",
						"S3_DEPLOY_KEY",
						"DeployKey",
					] as string[],
					environment: {
						type: "ARM_CONTAINER",
						computeType: AwsCodeBuildContainerRoundRobin.next().value,
						image: "aws/codebuild/amazonlinux-aarch64-standard:3.0",
						environmentVariables: [
							{
								name: "STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
								value: "<STACKREF_CODESTAR_ECR_REPOSITORY_ARN>",
								type: "PLAINTEXT",
							},
							{
								name: "STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
								value: "<STACKREF_CODESTAR_ECR_REPOSITORY_NAME>",
								type: "PLAINTEXT",
							},
							{
								name: "STACKREF_CODESTAR_ECR_REPOSITORY_URL",
								value: "<STACKREF_CODESTAR_ECR_REPOSITORY_URL>",
								type: "PLAINTEXT",
							},
							{
								name: "SOURCE_IMAGE_REPOSITORY",
								value: "SourceImage.RepositoryName",
								type: "PLAINTEXT",
							},
							{
								name: "SOURCE_IMAGE_URI",
								value: "SourceImage.ImageURI",
								type: "PLAINTEXT",
							},
							{
								name: "S3_DEPLOY_BUCKET",
								value: s3.artifacts.bucket,
								type: "PLAINTEXT",
							},
							{
								name: "S3_DEPLOY_KEY",
								value: "SourceImage.ImageURI",
								type: "PLAINTEXT",
							},
						] as { name: string; value: string; type: "PLAINTEXT" }[],
					},
					phases: {
						build: [
							"env",
							"docker --version",
							`aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $STACKREF_CODESTAR_ECR_REPOSITORY_URL`,
							"docker pull $SOURCE_IMAGE_URI",
							"docker images",
							// node_module
							[
								...[
									"docker run",
									...[
										"--detach",
										"--entrypoint deploy",
										`--env DEPLOY_FILTER=${PACKAGE_NAME}`,
										`--env DEPLOY_OUTPUT=/tmp/${PIPELINE_STAGE}`,
									],
									"$SOURCE_IMAGE_URI",
								],
								"> .container",
							].join(" "),
							"docker ps -al",
							...[2, 8, 4, 2].flatMap((i) => [
								`cat .container`,
								`sleep ${i}s`,
								`docker container logs $(cat .container)`,
							]),
							`mkdir -p $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION} || true`,
							`docker cp $(cat .container):/tmp/${PIPELINE_STAGE} $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}`,
							`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION} || true`,
							`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE} || true`,
							`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/node_modules || true`,
							// bootstrap binary
							...(LLRT_ARCH
								? [
										`echo 'LLRT_ARCH: ${LLRT_ARCH}, extracting bootstrap'`,
										[
											...[
												"docker run",
												...[
													"--detach",
													"--entrypoint bootstrap",
													`--env BOOTSTRAP_ARCH=llrt/${LLRT_ARCH}`,
												],
												"$SOURCE_IMAGE_URI",
											],
											"> .container",
										].join(" "),
										"docker ps -al",
										...[8, 4].flatMap((i) => [
											`cat .container`,
											`sleep ${i}s`,
											`docker container logs $(cat .container)`,
										]),
										`docker cp $(cat .container):/tmp/bootstrap $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/bootstrap`,
										`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION} || true`,
										`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE} || true`,
										`du -sh $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/${OUTPUT_DIRECTORY} || true`,
									]
								: [
										`echo 'No LLRT_ARCH specified, removing ${OUTPUT_DIRECTORY}'`,
										`rm -rf $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/${OUTPUT_DIRECTORY} || true`,
										`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE} || true`,
									]),
							`NODE_NO_WARNINGS=1 node -e '(${
								// biome-ignore lint/complexity/useArrowFunction:
								function () {
									const deploykey = (
										process.env.S3_DEPLOY_KEY ?? "UNKNOWN"
									).replace(/[^a-zA-Z0-9-_.]/g, "_");
									process.stdout.write(deploykey);
								}.toString()
							})()' > .deploykey`,
							"cat .deploykey",
							"aws s3 ls s3://$S3_DEPLOY_BUCKET",
							`export DeployKey=$(cat .deploykey)`,
							`echo $DeployKey`,
						] as string[],
					},
				},
				{
					stage: PIPELINE_STAGE,
					action: UPDATE_ACTION,
					artifact: {
						name: `${PIPELINE_STAGE}_${UPDATE_ACTION}`,
						baseDirectory: undefined as string | undefined,
						files: ["appspec.yml", "appspec.zip"] as string[],
					},
					variables: {
						APPSPEC_TEMPLATE: appspec({
							name: "<LAMBDA_FUNCTION_NAME>",
							alias: "<LAMBDA_FUNCTION_ALIAS>",
							currentVersion: "<CURRENT_VERSION>",
							targetVersion: "<TARGET_VERSION>",
						}).content,
						SOURCE_IMAGE_REPOSITORY: "<SOURCE_IMAGE_REPOSITORY>",
						SOURCE_IMAGE_URI: "<SOURCE_IMAGE_URI>",
						LAMBDA_FUNCTION_NAME: "<LAMBDA_FUNCTION_NAME>",
						S3_DEPLOY_BUCKET: "<S3_DEPLOY_BUCKET>",
						S3_DEPLOY_KEY: "<S3_DEPLOY_KEY>",
						DeployKey: "<DeployKey>",
					},
					exportedVariables: undefined as string[] | undefined,
					environment: {
						type: "ARM_CONTAINER",
						computeType: AwsCodeBuildContainerRoundRobin.next().value,
						image: "aws/codebuild/amazonlinux-aarch64-standard:3.0",
						environmentVariables: [
							{
								name: "SOURCE_IMAGE_REPOSITORY",
								value: "SourceImage.RepositoryName",
								type: "PLAINTEXT",
							},
							{
								name: "SOURCE_IMAGE_URI",
								value: "SourceImage.ImageURI",
								type: "PLAINTEXT",
							},
							{
								name: "LAMBDA_FUNCTION_NAME",
								value: "LAMBDA_FUNCTION_NAME",
								type: "PLAINTEXT",
							},
							{
								name: "LAMBDA_FUNCTION_ALIAS",
								value: "LAMBDA_FUNCTION_ALIAS",
								type: "PLAINTEXT",
							},
							{
								name: "S3_DEPLOY_BUCKET",
								value: s3.artifacts.bucket,
								type: "PLAINTEXT",
							},
							{
								name: "S3_DEPLOY_KEY",
								value: "SourceImage.ImageURI",
								type: "PLAINTEXT",
							},
							{
								name: "DeployKey",
								value: "HttpHandlerExtractImage.DeployKey",
								type: "PLAINTEXT",
							},
						] as { name: string; value: string; type: "PLAINTEXT" }[],
					},
					phases: {
						build: [
							"env",
							"aws s3 ls s3://$S3_DEPLOY_BUCKET",
							`export CURRENT_VERSION=$(aws lambda get-function --qualifier ${stage} --function-name $LAMBDA_FUNCTION_NAME --query 'Configuration.Version' --output text)`,
							"echo $CURRENT_VERSION",
							[
								"aws lambda update-function-configuration",
								"--function-name $LAMBDA_FUNCTION_NAME",
								`--handler httphandler/${HANDLER}`,
							].join(" "),
							"echo $DeployKey",
							[
								"aws lambda update-function-code",
								"--function-name $LAMBDA_FUNCTION_NAME",
								"--s3-bucket $S3_DEPLOY_BUCKET",
								"--s3-key $DeployKey",
								"--publish",
								"> .version",
							].join(" "),
							"export TARGET_VERSION=$(jq -r '.Version' .version)",
							"echo $TARGET_VERSION",
							"echo $APPSPEC_TEMPLATE",
							`NODE_NO_WARNINGS=1 node -e '(${
								// biome-ignore lint/complexity/useArrowFunction:
								function () {
									const template = process.env.APPSPEC_TEMPLATE;
									const lambdaArn = process.env.LAMBDA_FUNCTION_NAME;
									const lambdaAlias = process.env.LAMBDA_FUNCTION_ALIAS;
									const currentVersion = process.env.CURRENT_VERSION;
									const targetVersion = process.env.TARGET_VERSION;

									if (!template) {
										throw new Error("APPSPEC_TEMPLATE not set");
									}

									if (currentVersion === targetVersion) {
										throw new Error("Version is the same");
									}

									const appspec = template
										.replace("<LAMBDA_FUNCTION_NAME>", lambdaArn ?? "!")
										.replace("<LAMBDA_FUNCTION_ALIAS>", lambdaAlias ?? "!")
										.replace("<CURRENT_VERSION>", currentVersion ?? "!")
										.replace("<TARGET_VERSION>", targetVersion ?? "!");

									process.stdout.write(appspec);
								}.toString()
							})()' > appspec.yml`,
							"cat appspec.yml",
							"zip appspec.zip appspec.yml",
							"ls -al",
						] as string[],
					} as Record<string, string[]>,
				},
			] as const;

			const entries = Object.fromEntries(
				stages.map(
					({
						stage,
						action,
						artifact,
						environment,
						variables,
						phases,
						exportedVariables,
					}) => {
						const artifacts = new CodeBuildBuildspecArtifactsBuilder()
							.setFiles(artifact.files)
							.setName(artifact.name);

						if (artifact.baseDirectory) {
							artifacts.setBaseDirectory(artifact.baseDirectory);
						}

						const env = new CodeBuildBuildspecEnvBuilder().setVariables(
							variables,
						);
						if (exportedVariables) {
							env.setExportedVariables(exportedVariables);
						}

						const content = stringify(
							new CodeBuildBuildspecBuilder()
								.setVersion("0.2")
								.setArtifacts(artifacts)
								.setEnv(env)
								.setPhases({
									build:
										new CodeBuildBuildspecResourceLambdaPhaseBuilder().setCommands(
											phases.build,
										),
								})
								.build(),
						);

						const upload = new BucketObjectv2(_(`${artifact.name}-buildspec`), {
							bucket: s3.artifacts.bucket,
							content,
							key: `${artifact.name}/Buildspec.yml`,
						});

						const project = new Project(
							_(`${artifact.name}`),
							{
								description: `(${PACKAGE_NAME}) Deploy "${stage}" pipeline stage: "${action}"`,
								buildTimeout: 14,
								serviceRole: farRole.arn,
								artifacts: {
									type: "CODEPIPELINE",
									artifactIdentifier: artifact.name,
								},
								logsConfig: {
									cloudwatchLogs: {
										groupName: cloudwatch.build.loggroup.name,
										streamName: `${artifact.name}`,
									},
									// s3Logs: {
									// 	status: "ENABLED",
									// 	location: s3.build.bucket,
									// },
								},
								environment,
								source: {
									type: "CODEPIPELINE",
									buildspec: content,
								},
								tags: {
									Name: _(artifact.name),
									StackRef: STACKREF_ROOT,
									PackageName: PACKAGE_NAME,
									Handler: "http",
									DeployStage: stage,
									Action: action,
								},
							},
							{
								dependsOn: [
									upload,
									cloudmap.instance,
									handler.codedeploy.deploymentGroup,
								],
							},
						);

						return [
							artifact.name,
							{
								stage,
								action,
								artifactName: artifact.name,
								project,
								buildspec: {
									content,
									upload,
								},
							},
						];
					},
				),
			);

			return entries as Record<
				(typeof stages)[number]["artifact"]["name"],
				{
					stage: string;
					action: string;
					artifactName: string;
					project: Project;
					buildspec: {
						content: string;
						upload: BucketObjectv2;
					};
				}
			>;
		})();

		return {
			...project,
		} as const;
	})();

	const codepipeline = (() => {
		const pipeline = new Pipeline(
			_("deploy"),
			{
				pipelineType: "V2",
				roleArn: farRole.arn,
				executionMode: "QUEUED",
				artifactStores: [
					{
						location: s3.pipeline.bucket,
						type: "S3",
					},
				],
				stages: [
					{
						name: "Source",
						actions: [
							{
								name: "Image",
								namespace: "SourceImage",
								category: "Source",
								owner: "AWS",
								provider: "ECR",
								version: "1",
								outputArtifacts: ["source_image"],
								configuration: all([__codestar.ecr.repository.name]).apply(
									([repositoryName]) => {
										return {
											RepositoryName: repositoryName,
											ImageTag: stage,
										};
									},
								),
							},
						],
					},
					{
						name: "HttpHandler",
						actions: [
							{
								runOrder: 1,
								name: "ExtractImage",
								namespace: "HttpHandlerExtractImage",
								category: "Build",
								owner: "AWS",
								provider: "CodeBuild",
								version: "1",
								inputArtifacts: ["source_image"],
								outputArtifacts: [
									codebuild.httphandler_extractimage.artifactName,
								],
								configuration: all([
									__codestar.ecr.repository.arn,
									__codestar.ecr.repository.name,
									__codestar.ecr.repository.url,
									codebuild.httphandler_extractimage.project.name,
									s3.artifacts.bucket,
								]).apply(
									([
										repositoryArn,
										repositoryName,
										repositoryUrl,
										projectExtractImageName,
										deployBucketName,
									]) => {
										return {
											ProjectName: projectExtractImageName,
											EnvironmentVariables: JSON.stringify([
												{
													name: "STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
													value: repositoryArn,
													type: "PLAINTEXT",
												},
												{
													name: "STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
													value: repositoryName,
													type: "PLAINTEXT",
												},
												{
													name: "STACKREF_CODESTAR_ECR_REPOSITORY_URL",
													value: repositoryUrl,
													type: "PLAINTEXT",
												},
												{
													name: "SOURCE_IMAGE_REPOSITORY",
													value: "#{SourceImage.RepositoryName}",
													type: "PLAINTEXT",
												},
												{
													name: "SOURCE_IMAGE_URI",
													value: "#{SourceImage.ImageURI}",
													type: "PLAINTEXT",
												},
												{
													name: "S3_DEPLOY_BUCKET",
													value: deployBucketName,
													type: "PLAINTEXT",
												},
												{
													name: "S3_DEPLOY_KEY",
													value: "#{SourceImage.ImageURI}",
													type: "PLAINTEXT",
												},
											]),
										};
									},
								),
							},
							{
								runOrder: 2,
								name: "UploadS3",
								namespace: "HttpHandlerUploadS3",
								category: "Deploy",
								owner: "AWS",
								provider: "S3",
								version: "1",
								inputArtifacts: [
									codebuild.httphandler_extractimage.artifactName,
								],
								configuration: all([s3.artifacts.bucket]).apply(
									([BucketName]) => ({
										BucketName,
										Extract: "false",
										ObjectKey: "#{HttpHandlerExtractImage.DeployKey}",
									}),
								),
							},
							{
								runOrder: 3,
								name: "UpdateLambda",
								namespace: "HttpHandlerUpdateLambda",
								category: "Build",
								owner: "AWS",
								provider: "CodeBuild",
								version: "1",
								inputArtifacts: [
									codebuild.httphandler_extractimage.artifactName,
								],
								outputArtifacts: [
									codebuild.httphandler_updatelambda.artifactName,
								],
								configuration: all([
									codebuild.httphandler_updatelambda.project.name,
									handler.http.name,
									handler.http.alias.name,
									s3.artifacts.bucket,
								]).apply(
									([
										projectName,
										functionName,
										aliasName,
										deployBucketName,
									]) => {
										return {
											ProjectName: projectName,
											EnvironmentVariables: JSON.stringify([
												{
													name: "SOURCE_IMAGE_REPOSITORY",
													value: "#{SourceImage.RepositoryName}",
													type: "PLAINTEXT",
												},
												{
													name: "SOURCE_IMAGE_URI",
													value: "#{SourceImage.ImageURI}",
													type: "PLAINTEXT",
												},
												{
													name: "LAMBDA_FUNCTION_NAME",
													value: functionName,
													type: "PLAINTEXT",
												},
												{
													name: "LAMBDA_FUNCTION_ALIAS",
													value: aliasName,
													type: "PLAINTEXT",
												},
												{
													name: "S3_DEPLOY_BUCKET",
													value: deployBucketName,
													type: "PLAINTEXT",
												},
												{
													name: "S3_DEPLOY_KEY",
													value: "#{SourceImage.ImageURI}",
													type: "PLAINTEXT",
												},
												{
													name: "DeployKey",
													value: "#{HttpHandlerExtractImage.DeployKey}",
													type: "PLAINTEXT",
												},
											]),
										};
									},
								),
							},
							{
								runOrder: 4,
								name: "Cutover",
								category: "Deploy",
								owner: "AWS",
								provider: "CodeDeploy",
								version: "1",
								inputArtifacts: [
									codebuild.httphandler_updatelambda.artifactName,
								],
								configuration: all([
									__codestar.codedeploy.application.name,
									handler.codedeploy.deploymentGroup.deploymentGroupName,
								]).apply(([applicationName, deploymentGroupName]) => {
									return {
										ApplicationName: applicationName,
										DeploymentGroupName: deploymentGroupName,
									};
								}),
							},
						],
					},
				],
				tags: {
					Name: _("deploy"),
					StackRef: STACKREF_ROOT,
					PackageName: PACKAGE_NAME,
				},
			},
			{
				dependsOn: [handler.codedeploy.deploymentGroup],
			},
		);

		new RolePolicyAttachment(_("codepipeline-rolepolicy"), {
			policyArn: ManagedPolicy.CodePipeline_FullAccess,
			role: farRole.name,
		});

		return {
			pipeline,
		};
	})();

	// Eventbridge
	const eventbridge = (() => {
		const { name: codestarRepositoryName } = __codestar.ecr.repository;

		const rule = new EventRule(_("on-ecr-push"), {
			description: `(${PACKAGE_NAME}) ECR image deploy pipeline trigger for tag "${stage}"`,
			state: "ENABLED",
			eventPattern: JSON.stringify({
				source: ["aws.ecr"],
				"detail-type": ["ECR Image Action"],
				detail: {
					"repository-name": [codestarRepositoryName],
					"action-type": ["PUSH"],
					result: ["SUCCESS"],
					"image-tag": [stage],
				},
			}),
			tags: {
				Name: _(`on-ecr-push`),
				StackRef: STACKREF_ROOT,
			},
		});

		const pipeline = new EventTarget(_("on-ecr-push-deploy"), {
			rule: rule.name,
			arn: codepipeline.pipeline.arn,
			roleArn: farRole.arn,
		});

		return {
			EcrImageAction: {
				rule,
				targets: {
					pipeline,
				},
			},
		};
	})();

	// Outputs
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
			}),
		) as Record<keyof typeof s3, Output<{ bucket: string; region: string }>>,
	);

	const cloudwatchOutput = Output.create(
		Object.fromEntries(
			Object.entries(cloudwatch).map(([key, { loggroup }]) => {
				return [
					key,
					all([loggroup.name, loggroup.arn]).apply(([name, arn]) => ({
						logGroup: {
							name,
							arn,
						},
					})),
				];
			}),
		) as Record<
			keyof typeof cloudwatch,
			Output<{ logGroup: { name: string; arn: string } }>
		>,
	);

	const codebuildProjectsOutput = Output.create(
		Object.fromEntries(
			Object.entries(codebuild).map(([key, resources]) => {
				return [
					key,
					all([
						resources.project.arn,
						resources.project.name,
						resources.buildspec.upload.bucket,
						resources.buildspec.upload.key,
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
			keyof typeof codebuild,
			Output<{
				buildspec: { bucket: string; key: string };
				project: { arn: string; name: string };
			}>
		>,
	);

	const handlerOutput = Output.create(handler).apply((handler) => ({
		role: all([handler.role.arn, handler.role.name]).apply(([arn, name]) => ({
			arn,
			name,
		})),
		function: all([
			handler.http.arn,
			handler.http.name,
			handler.http.url,
			handler.http.version.version,
			handler.http.alias.arn,
			handler.http.alias.name,
			handler.http.alias.functionVersion,
		]).apply(
			([arn, name, url, version, aliasArn, aliasName, functionVersion]) => ({
				arn,
				name,
				url,
				version,
				alias: {
					arn: aliasArn,
					name: aliasName,
					functionVersion,
				},
			}),
		),
		codedeploy: all([
			handler.codedeploy.deploymentGroup.arn,
			handler.codedeploy.deploymentGroup.deploymentGroupName,
		]).apply(([arn, name]) => ({ deploymentGroup: { arn, name } })),
	}));

	const cloudmapOutput = Output.create(cloudmap).apply((cloudmap) => ({
		namespace: {
			arn: __datalayer.cloudmap.namespace.arn,
			name: __datalayer.cloudmap.namespace.name,
			id: __datalayer.cloudmap.namespace.id,
			hostedZone: __datalayer.cloudmap.namespace.hostedZone,
		},
		service: all([cloudmap.service.arn, cloudmap.service.name]).apply(
			([arn, name]) => ({ arn, name }),
		),
		instance: all([
			cloudmap.instance.instanceId,
			cloudmap.instance.attributes,
		]).apply(([id, attributes]) => ({ id, attributes })),
	}));

	const codepipelineOutput = Output.create(codepipeline).apply(
		(codepipeline) => ({
			pipeline: all([
				codepipeline.pipeline.arn,
				codepipeline.pipeline.name,
				codepipeline.pipeline.roleArn,
				codepipeline.pipeline.stages.apply((stages) =>
					stages.map((stage) => ({
						name: stage.name,
						actions: stage.actions.map((action) => ({
							runOrder: action.runOrder,
							name: action.name,
							category: action.category,
							provider: action.provider,
							configuration: action.configuration,
						})),
					})),
				),
			]).apply(([arn, name, roleArn, stages]) => ({
				arn,
				name,
				roleArn,
				stages,
			})),
		}),
	);

	const eventbridgeRulesOutput = Output.create(eventbridge).apply(
		(eventbridge) => {
			return Object.fromEntries(
				Object.entries(eventbridge).map(([key, value]) => {
					return [
						key,
						all([
							value.rule.arn,
							value.rule.name,
							Output.create(value.targets).apply(
								(targets) =>
									Object.fromEntries(
										Object.entries(targets).map(([key, value]) => {
											return [
												key,
												all([value.arn, value.targetId]).apply(
													([arn, targetId]) => ({ arn, targetId }),
												),
											];
										}),
									) as Record<
										keyof typeof value.targets,
										Output<{ arn: string; targetId: string }>
									>,
							) as Record<
								keyof typeof value.targets,
								Output<{ arn: string; targetId: string }>
							>,
						]).apply(([ruleArn, ruleName, targets]) => ({
							rule: {
								arn: ruleArn,
								name: ruleName,
							},
							targets,
						})),
					];
				}),
			);
		},
	);

	return all([
		s3Output,
		cloudwatchOutput,
		handlerOutput,
		cloudmapOutput,
		codebuildProjectsOutput,
		codepipelineOutput,
		eventbridgeRulesOutput,
	]).apply(
		([
			fourtwo_panel_http_s3,
			fourtwo_panel_http_cloudwatch,
			fourtwo_panel_http_lambda,
			fourtwo_panel_http_cloudmap,
			fourtwo_panel_http_codebuild,
			fourtwo_panel_http_codepipeline,
			fourtwo_panel_http_eventbridge,
		]) => {
			const fourtwo_panel_http_routemap = (() => {
				const routes: Partial<
					Record<WWWIntraRoute, Route<LambdaRouteResource>>
				> = {
					["/~/v1/Fourtwo/Panel"]: {
						$kind: "LambdaRouteResource",
						lambda: {
							arn: fourtwo_panel_http_lambda.function.arn,
							name: fourtwo_panel_http_lambda.function.name,
							role: {
								arn: fourtwo_panel_http_lambda.role.arn,
								name: fourtwo_panel_http_lambda.role.name,
							},
							qualifier: fourtwo_panel_http_lambda.function.alias.name,
						},
						hostname: fourtwo_panel_http_lambda.function.url.replace(
							"https://",
							"",
						),
						protocol: "https",
						cloudmap: {
							namespace: {
								arn: fourtwo_panel_http_cloudmap.namespace.arn,
								name: fourtwo_panel_http_cloudmap.namespace.name,
								id: fourtwo_panel_http_cloudmap.namespace.id,
								hostedZone: fourtwo_panel_http_cloudmap.namespace.hostedZone,
							},
							service: {
								arn: fourtwo_panel_http_cloudmap.service.arn,
								name: fourtwo_panel_http_cloudmap.service.name,
							},
							instance: {
								id: fourtwo_panel_http_cloudmap.instance.id,
								attributes: fourtwo_panel_http_cloudmap.instance.attributes,
							},
						},
					},
				};
				return routes;
			})();

			const exported = {
				fourtwo_panel_http_imports: {
					fourtwo: {
						codestar: __codestar,
						datalayer: __datalayer,
					},
				},
				fourtwo_panel_http_s3,
				fourtwo_panel_http_cloudwatch,
				fourtwo_panel_http_lambda,
				fourtwo_panel_http_cloudmap,
				fourtwo_panel_http_codebuild,
				fourtwo_panel_http_codepipeline,
				fourtwo_panel_http_eventbridge,
				fourtwo_panel_http_routemap,
			} satisfies z.infer<typeof FourtwoPanelHttpStackExportsZod> & {
				fourtwo_panel_http_imports: {
					fourtwo: {
						codestar: typeof __codestar;
						datalayer: typeof __datalayer;
					};
				};
			};
			const validate = FourtwoPanelHttpStackExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}

			return exported;
		},
	);
};
