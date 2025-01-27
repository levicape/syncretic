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
import { Output, all, getStack } from "@pulumi/pulumi";
import { AssetArchive, StringAsset } from "@pulumi/pulumi/asset";
import { stringify } from "yaml";
import { $ref, $val } from "../../../Stack";
import { FourtwoCodestarStackExportsZod } from "../../../codestar/exports";
import { FourtwoDatalayerStackExportsZod } from "../../../datalayer/exports";

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? "fourtwo";
const PACKAGE_NAME = "@levicape/fourtwo-panel-io" as const;
const ARTIFACT_ROOT = "fourtwo-panel-io" as const;
const HANDLER = "fourtwo-panel-io/module/lambda/HttpHandler.handler";

const CI = {
	CI_ENVIRONMENT: process.env.CI_ENVIRONMENT ?? "unknown",
	CI_ACCESS_ROLE: process.env.CI_ACCESS_ROLE ?? "FourtwoAccessRole",
};
export = async () => {
	const context = await Context.fromConfig();
	const _ = (name: string) => `${context.prefix}-${name}`;
	const stage = CI.CI_ENVIRONMENT;
	const farRole = await getRole({ name: CI.CI_ACCESS_ROLE });

	// Stack references
	const __codestar = await (async () => {
		const code = $ref(`${STACKREF_ROOT}-codestar`);
		return {
			codedeploy: $val(
				(await code.getOutputDetails(`${STACKREF_ROOT}_codestar_codedeploy`))
					.value,
				FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_codedeploy,
			),
			ecr: $val(
				(await code.getOutputDetails(`${STACKREF_ROOT}_codestar_ecr`)).value,
				FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_ecr,
			),
		};
	})();

	const __datalayer = await (async () => {
		const data = $ref(`${STACKREF_ROOT}-datalayer`);
		return {
			props: $val(
				(
					await data.getOutputDetails(
						`_${STACKREF_ROOT.toUpperCase()}_DATALAYER_PROPS`,
					)
				).value,
				FourtwoDatalayerStackExportsZod.shape._FOURTWO_DATALAYER_PROPS,
			),
			ec2: $val(
				(await data.getOutputDetails(`${STACKREF_ROOT}_datalayer_ec2`)).value,
				FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_ec2,
			),
			efs: $val(
				(await data.getOutputDetails(`${STACKREF_ROOT}_datalayer_efs`)).value,
				FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_efs,
			),
			iam: $val(
				(await data.getOutputDetails(`${STACKREF_ROOT}_datalayer_iam`)).value,
				FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_iam,
			),
			cloudmap: $val(
				(await data.getOutputDetails(`${STACKREF_ROOT}_datalayer_cloudmap`))
					.value,
				FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_cloudmap,
			),
		};
	})();
	//

	// Object Store
	const s3 = (() => {
		const bucket = (name: string) => {
			const bucket = new Bucket(_(name), {
				acl: "private",
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
						id: "ExpireObjects",
						expiration: {
							days: context.environment.isProd ? 30 : 12,
						},
					},
				],
			});
			return bucket;
		};
		return {
			artifactStore: bucket("artifact-store"),
			build: bucket("build"),
			deploy: bucket("deploy"),
		};
	})();

	// Logging
	const cloudwatch = (() => {
		const loggroup = new LogGroup(_("loggroup"), {
			retentionInDays: 365,
		});

		return {
			loggroup,
		};
	})();

	// Compute
	const handler = await (async ({ datalayer, codestar }, cloudwatch) => {
		const role = datalayer.iam.roles.lambda.name;
		const roleArn = datalayer.iam.roles.lambda.arn;
		const loggroup = cloudwatch.loggroup;

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
			bucket: s3.deploy.bucket,
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
		});

		const lambda = new LambdaFn(
			_("function"),
			{
				description: `(${getStack()}) Lambda function for ${PACKAGE_NAME}`,
				role: roleArn,
				architectures: ["arm64"],
				memorySize: Number.parseInt(context.environment.isProd ? "512" : "256"),
				timeout: 18,
				packageType: "Zip",
				runtime: Runtime.NodeJS22dX,
				handler: "index.handler",
				s3Bucket: s3.deploy.bucket,
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
					logGroup: cloudwatch.loggroup.name,
					applicationLogLevel: "DEBUG",
				},
				environment: all([cloudmapEnvironment]).apply(([cloudmapEnv]) => {
					return {
						variables: {
							...cloudmapEnv,
						},
					};
				}),
			},
			{
				dependsOn: zip,
				ignoreChanges: ["handler", "s3Key", "s3ObjectVersion"],
			},
		);

		const hostnames: string[] =
			context?.frontend?.dns?.hostnames
				?.map((host) => [`https://${host}`, `https://www.${host}`])
				.reduce((acc, current) => [...acc, ...current], []) ?? [];

		const version = new Version(_("version"), {
			functionName: lambda.name,
			description: `(${getStack()}) Version ${stage} for ${PACKAGE_NAME} on ${_("")}`,
		});

		const alias = new Alias(
			_("alias"),
			{
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
				allowOrigins: hostnames,
				maxAge: 86400,
			},
		});

		const deploymentGroup = new DeploymentGroup(
			_("deployment-group"),
			{
				deploymentGroupName: _("deployment-group-bg"),
				serviceRoleArn: farRole.arn,
				appName: codestar.codedeploy.application.name,
				deploymentConfigName: codestar.codedeploy.deploymentConfig.name,
				deploymentStyle: {
					deploymentOption: "WITH_TRAFFIC_CONTROL",
					deploymentType: "BLUE_GREEN",
				},
			},
			{
				deleteBeforeReplace: true,
				replaceOnChanges: ["*"],
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
			name: _("service"),
			description: `(${getStack()}) Service mesh service for ${PACKAGE_NAME}`,
			dnsConfig: {
				namespaceId: namespace.id,
				routingPolicy: "WEIGHTED",
				dnsRecords: [
					{
						type: "CNAME",
						ttl: 55,
					},
				],
			},
		});

		const cloudMapInstance = new Instance(_("instance"), {
			serviceId: cloudMapService.id,
			instanceId: _("instance"),
			attributes: {
				AWS_INSTANCE_CNAME: handler.http.url,
				LAMBDA_FUNCTION_ARN: handler.http.arn,
				STACK_NAME: _("").slice(0, -1),
				CI_ENVIRONMENT: stage,
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
			const stages = [
				{
					artifact: {
						name: "httphandler_extractimage",
						baseDirectory: ".extractimage" as string | undefined,
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
						computeType: "BUILD_GENERAL1_MEDIUM",
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
								value: s3.deploy.bucket,
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
							[
								"docker run",
								"--detach",
								"--entrypoint",
								"deploy",
								`-e DEPLOY_FILTER=${PACKAGE_NAME}`,
								`-e DEPLOY_OUTPUT=/tmp/${ARTIFACT_ROOT}`,
								"$SOURCE_IMAGE_URI",
								"> .container",
							].join(" "),
							"docker ps -al",
							"cat .container",
							"sleep 10s",
							`docker container logs $(cat .container)`,
							"cat .container",
							"sleep 9s",
							`docker container logs $(cat .container)`,
							"cat .container",
							"sleep 8s",
							`docker container logs $(cat .container)`,
							"mkdir -p $CODEBUILD_SRC_DIR/.extractimage || true",
							`docker cp $(cat .container):/tmp/${ARTIFACT_ROOT} $CODEBUILD_SRC_DIR/.extractimage`,
							"ls -al $CODEBUILD_SRC_DIR/.extractimage || true",
							`ls -al $CODEBUILD_SRC_DIR/.extractimage/${ARTIFACT_ROOT} || true`,
							"corepack -g install pnpm@9 || true",
							`pnpm -C $CODEBUILD_SRC_DIR/.extractimage/${ARTIFACT_ROOT} install --offline --prod --ignore-scripts --node-linker=hoisted || true`,
							`ls -al $CODEBUILD_SRC_DIR/.extractimage/${ARTIFACT_ROOT}/node_modules || true`,
							`NODE_NO_WARNINGS=1 node -e '(${(
								// biome-ignore lint/complexity/useArrowFunction:
								function () {
									const deploykey = (
										process.env.S3_DEPLOY_KEY ?? "UNKNOWN"
									).replace(/[^a-zA-Z0-9-_.]/g, "_");
									process.stdout.write(deploykey);
								}
							).toString()})()' > .deploykey`,
							"cat .deploykey",
							"aws s3 ls s3://$S3_DEPLOY_BUCKET",
							`export DeployKey=$(cat .deploykey)`,
							`echo $DeployKey`,
						] as string[],
					},
				},
				{
					artifact: {
						name: "httphandler_updatelambda",
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
						type: "ARM_LAMBDA_CONTAINER",
						computeType: "BUILD_LAMBDA_2GB",
						image: "aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs20",
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
								value: s3.deploy.bucket,
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
								`--handler ${HANDLER}`,
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
							`NODE_NO_WARNINGS=1 node -e '(${(
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
								}
							).toString()})()' > appspec.yml`,
							"cat appspec.yml",
							"zip appspec.zip appspec.yml",
							"ls -al",
						] as string[],
					} as Record<string, string[]>,
				},
			] as const;

			const entries = Object.fromEntries(
				stages.map(
					({ artifact, environment, variables, phases, exportedVariables }) => {
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

						const upload = new BucketObjectv2(_(`buildspec-${artifact.name}`), {
							bucket: s3.build.bucket,
							content,
							key: `${artifact.name}/Buildspec.yml`,
						});

						const project = new Project(
							_(`project-${artifact.name}`),
							{
								description: `(${getStack()}) CodeBuild project: ${artifact.name} on ${_("")}`,
								buildTimeout: 12,
								serviceRole: farRole.arn,
								artifacts: {
									type: "CODEPIPELINE",
									artifactIdentifier: artifact.name,
								},
								environment,
								source: {
									type: "CODEPIPELINE",
									buildspec: content,
								},
							},
							{
								dependsOn: [upload],
							},
						);

						return [
							artifact.name,
							{
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
			_("pipeline-deploy"),
			{
				pipelineType: "V2",
				roleArn: farRole.arn,
				executionMode: "QUEUED",
				artifactStores: [
					{
						location: s3.artifactStore.bucket,
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
								outputArtifacts: ["httphandler_extractimage"],
								configuration: all([
									__codestar.ecr.repository.arn,
									__codestar.ecr.repository.name,
									__codestar.ecr.repository.url,
									codebuild.httphandler_extractimage.project.name,
									s3.deploy.bucket,
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
								inputArtifacts: ["httphandler_extractimage"],
								configuration: all([s3.deploy.bucket]).apply(
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
								inputArtifacts: ["httphandler_extractimage"],
								outputArtifacts: ["httphandler_updatelambda"],
								configuration: all([
									codebuild.httphandler_updatelambda.project.name,
									handler.http.name,
									handler.http.alias.name,
									s3.deploy.bucket,
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
								inputArtifacts: ["httphandler_updatelambda"],
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

		const rule = new EventRule(_("event-rule-ecr-push"), {
			description: `(${getStack()}) ECR push event rule for ${PACKAGE_NAME} on ${_("")}`,
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
		});
		const pipeline = new EventTarget(_("event-target-pipeline"), {
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
					all([bucket.bucket]).apply(([bucketName]) => ({
						bucket: bucketName,
					})),
				];
			}),
		),
	);

	const cloudwatchOutput = Output.create(cloudwatch).apply((cloudwatch) => ({
		loggroup: all([cloudwatch.loggroup.arn]).apply(([loggroupArn]) => ({
			arn: loggroupArn,
		})),
	}));

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
		),
	);

	const handlerOutput = Output.create(handler).apply((handler) => ({
		role: all([handler.role.arn, handler.role.name]).apply(([arn, name]) => ({
			arn,
			name,
		})),
		http: all([
			handler.http.arn,
			handler.http.url,
			handler.http.version.version,
			handler.http.alias.arn,
			handler.http.alias.name,
			handler.http.alias.functionVersion,
		]).apply(([arn, url, version, aliasArn, aliasName, functionVersion]) => ({
			arn,
			url,
			version,
			alias: {
				arn: aliasArn,
				name: aliasName,
				functionVersion,
			},
		})),
		codedeploy: all([
			handler.codedeploy.deploymentGroup.arn,
			handler.codedeploy.deploymentGroup.deploymentGroupName,
		]).apply(([arn, name]) => ({ arn, name })),
	}));

	const cloudmapOutput = Output.create(cloudmap).apply((cloudmap) => ({
		application: {
			name: __codestar.codedeploy.application.name,
			arn: __codestar.codedeploy.application.arn,
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
							Output.create(value.targets).apply((targets) =>
								Object.fromEntries(
									Object.entries(targets).map(([key, value]) => {
										return [
											key,
											all([value.arn, value.targetId]).apply(
												([arn, targetId]) => ({ arn, targetId }),
											),
										];
									}),
								),
							),
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
			return {
				_FOURTWO_PANEL_HTTP_IMPORTS: {
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
			};
		},
	);
};
