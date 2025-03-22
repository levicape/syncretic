import { inspect } from "node:util";
import {
	CodeBuildBuildspecArtifactsBuilder,
	CodeBuildBuildspecBuilder,
	CodeBuildBuildspecEnvBuilder,
	CodeBuildBuildspecResourceLambdaPhaseBuilder,
	CodeDeployAppspecBuilder,
	CodeDeployAppspecResourceBuilder,
} from "@levicape/fourtwo-builders/commonjs/index.cjs";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Version } from "@pulumi/aws-native/lambda";
import { Deployment, Environment } from "@pulumi/aws/appconfig";
import { ConfigurationProfile } from "@pulumi/aws/appconfig/configurationProfile";
import { HostedConfigurationVersion } from "@pulumi/aws/appconfig/hostedConfigurationVersion";
import { EventRule, EventTarget } from "@pulumi/aws/cloudwatch";
import { LogGroup } from "@pulumi/aws/cloudwatch/logGroup";
import { Project } from "@pulumi/aws/codebuild";
import { DeploymentGroup } from "@pulumi/aws/codedeploy/deploymentGroup";
import { Pipeline } from "@pulumi/aws/codepipeline";
import { getRole } from "@pulumi/aws/iam/getRole";
import {
	Alias,
	Function as LambdaFn,
	Permission,
	Runtime,
} from "@pulumi/aws/lambda";
import {
	Bucket,
	BucketLifecycleConfigurationV2,
	BucketServerSideEncryptionConfigurationV2,
} from "@pulumi/aws/s3";
import { BucketObjectv2 } from "@pulumi/aws/s3/bucketObjectv2";
import { BucketPublicAccessBlock } from "@pulumi/aws/s3/bucketPublicAccessBlock";
import { BucketVersioningV2 } from "@pulumi/aws/s3/bucketVersioningV2";
import { Output, all, interpolate, log } from "@pulumi/pulumi";
import { AssetArchive } from "@pulumi/pulumi/asset/archive";
import { StringAsset } from "@pulumi/pulumi/asset/asset";
import { error, warn } from "@pulumi/pulumi/log";
import { RandomId } from "@pulumi/random/RandomId";
import { serializeError } from "serialize-error";
import { stringify } from "yaml";
import type { z } from "zod";
import { AwsCodeBuildContainerRoundRobin } from "../../../RoundRobin";
import { $deref, type DereferencedOutput } from "../../../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../../../application/exports";
import { FourtwoCodestarStackExportsZod } from "../../../codestar/exports";
import { FourtwoDatalayerStackExportsZod } from "../../../datalayer/exports";
import {
	FourtwoPanelHttpStackExportsZod,
	FourtwoPanelHttpStackrefRoot,
} from "../http/exports";
import {
	FourtwoPanelWebStackExportsZod,
	FourtwoPanelWebStackrefRoot,
} from "../web/exports";
import type { FourtwoPanelMonitorStackExportsZod } from "./exports";

const WORKSPACE_PACKAGE_NAME = "@levicape/fourtwo-panel-io";
const CI = {
	CI_ENVIRONMENT: process.env.CI_ENVIRONMENT ?? "unknown",
	CI_ACCESS_ROLE: process.env.CI_ACCESS_ROLE ?? "FourtwoAccessRole",
};

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? FourtwoApplicationRoot;
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		application: {
			refs: {
				servicecatalog:
					FourtwoApplicationStackExportsZod.shape
						.fourtwo_application_servicecatalog,
			},
		},
		codestar: {
			refs: {
				appconfig:
					FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_appconfig,
				codedeploy:
					FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_codedeploy,
				ecr: FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_ecr,
				codeartifact:
					FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_codeartifact,
				ssm: FourtwoCodestarStackExportsZod.shape.fourtwo_codestar_ssm,
			},
		},
		datalayer: {
			refs: {
				props: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_props,
				iam: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_iam,
				cloudmap:
					FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_cloudmap,
			},
		},
		[FourtwoPanelHttpStackrefRoot]: {
			refs: {
				cloudmap:
					FourtwoPanelHttpStackExportsZod.shape.fourtwo_panel_http_cloudmap,
				routemap:
					FourtwoPanelHttpStackExportsZod.shape.fourtwo_panel_http_routemap,
			},
		},
		[FourtwoPanelWebStackrefRoot]: {
			refs: {
				s3: FourtwoPanelWebStackExportsZod.shape.fourtwo_panel_web_s3,
				routemap:
					FourtwoPanelWebStackExportsZod.shape.fourtwo_panel_web_routemap,
			},
		},
	},
} as const;

const HANDLER_TYPE = "monitorhandler" as const;

const ROUTE_MAP = (
	stackrefs$: DereferencedOutput<typeof STACKREF_CONFIG>[typeof STACKREF_ROOT],
) => {
	return {
		...stackrefs$[FourtwoPanelHttpStackrefRoot].routemap,
		...stackrefs$[FourtwoPanelWebStackrefRoot].routemap,
	};
};

const ATLASFILE_PATHS = {
	routes: {
		content: ROUTE_MAP,
		path: "atlas.routes.json",
	},
} as const;

const ENVIRONMENT = (
	_$refs: DereferencedOutput<typeof STACKREF_CONFIG>[typeof STACKREF_ROOT],
) => {
	return {
		...Object.fromEntries([
			...Object.entries(ATLASFILE_PATHS).map(([name, { path }]) => [
				`ATLAS_${name.toUpperCase()}`,
				`file://$LAMBDA_TASK_ROOT/${HANDLER_TYPE}/${path}`,
			]),
		]),
	} as const;
};

const LLRT_ARCH: string | undefined = process.env["LLRT_ARCH"];
const LLRT_PLATFORM: "node" | "browser" | undefined = LLRT_ARCH
	? "node"
	: undefined;

const OUTPUT_DIRECTORY = `output/esbuild`;
const CANARY_PATHS = [
	{
		name: "HttpHandler",
		description: "Tests Panel http handlers",
		packageName: "@levicape/fourtwo-panel-io",
		handler: `${LLRT_ARCH ? OUTPUT_DIRECTORY : "module"}/canary/Http.handler`,
		environment: ENVIRONMENT,
		routemap: ROUTE_MAP,
	},
] as const;

export = async () => {
	// Stack references
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const {
		codestar: $codestar,
		datalayer: $datalayer,
		application: $application,
	} = dereferenced$;

	const context = await Context.fromConfig({
		aws: {
			awsApplication: $application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	const stage = CI.CI_ENVIRONMENT;
	const automationRole = await getRole({
		name: $datalayer.iam.roles.automation.name,
	});
	// Object Store
	const s3 = (() => {
		const bucket = (name: string) => {
			const randomid = new RandomId(_(`${name}-id`), {
				byteLength: 4,
			});

			const urlsafe = _(name).replace(/[^a-zA-Z0-9]/g, "-");
			const bucket = new Bucket(
				_(name),
				{
					bucket: interpolate`${urlsafe}-${randomid.hex}`,
					acl: "private",
					forceDestroy: !context.environment.isProd,
					tags: {
						Name: _(name),
						StackRef: STACKREF_ROOT,
						PackageName: WORKSPACE_PACKAGE_NAME,
						Key: name,
					},
				},
				{
					ignoreChanges: [
						"acl",
						"lifecycleRules",
						"loggings",
						"policy",
						"serverSideEncryptionConfiguration",
						"versioning",
						"website",
						"websiteDomain",
						"websiteEndpoint",
					],
				},
			);

			new BucketServerSideEncryptionConfigurationV2(
				_(`${name}-encryption`),
				{
					bucket: bucket.bucket,
					rules: [
						{
							applyServerSideEncryptionByDefault: {
								sseAlgorithm: "AES256",
							},
						},
					],
				},
				{
					deletedWith: bucket,
				},
			);

			new BucketVersioningV2(
				_(`${name}-versioning`),

				{
					bucket: bucket.bucket,
					versioningConfiguration: {
						status: "Enabled",
					},
				},
				{
					deletedWith: bucket,
				},
			);
			new BucketPublicAccessBlock(
				_(`${name}-public-access-block`),
				{
					bucket: bucket.bucket,
					blockPublicAcls: true,
					blockPublicPolicy: true,
					ignorePublicAcls: true,
					restrictPublicBuckets: true,
				},
				{
					deletedWith: bucket,
				},
			);

			new BucketLifecycleConfigurationV2(
				_(`${name}-lifecycle`),
				{
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
				},
				{
					deletedWith: bucket,
				},
			);

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
			const loggroup = new LogGroup(_(`${name}-loggroup`), {
				retentionInDays: context.environment.isProd ? 90 : 14,
				tags: {
					Name: _(`${name}-loggroup`),
					StackRef: STACKREF_ROOT,
					PackageName: WORKSPACE_PACKAGE_NAME,
				},
			});

			return { loggroup };
		};

		return {
			build: loggroup("build"),
		};
	})();

	// Bucket objects
	const zip = new BucketObjectv2(_(`codezip`), {
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
		key: `monitor.zip`,
		tags: {
			Name: _(`codezip`),
			StackRef: STACKREF_ROOT,
			PackageName: WORKSPACE_PACKAGE_NAME,
			Handler: "Monitor",
		},
	});

	// Configuration
	const appconfig = (() => {
		const environment = new Environment(
			_("environment"),
			{
				applicationId: $codestar.appconfig.application.id,
				description: `(${WORKSPACE_PACKAGE_NAME}) "Monitor" in #${stage}`,
				tags: {
					Name: _("environment"),
					StackRef: STACKREF_ROOT,
					PackageName: WORKSPACE_PACKAGE_NAME,
					Kind: "Monitor",
				},
			},
			{
				dependsOn: [s3.artifacts],
			},
		);

		return {
			environment,
		};
	})();

	// Compute
	const handler = async (
		{
			name,
			description,
			packageName,
			handler,
			environment,
		}: (typeof CANARY_PATHS)[number],
		{
			datalayer,
			codestar,
		}: { datalayer: typeof $datalayer; codestar: typeof $codestar },
		cw: typeof cloudwatch,
	) => {
		const roleArn = datalayer.iam.roles.lambda.arn;

		const loggroup = new LogGroup(_(`${name}-log`), {
			retentionInDays: context.environment.isProd ? 90 : 30,
			tags: {
				Name: _(`${name}-log`),
				StackRef: STACKREF_ROOT,
				PackageName: WORKSPACE_PACKAGE_NAME,
				Kind: "Monitor",
				Monitor: name,
				MonitorPackageName: packageName,
			},
		});

		const cloudmapEnvironment = {
			AWS_CLOUDMAP_NAMESPACE_ID: datalayer.cloudmap.namespace.id,
			AWS_CLOUDMAP_NAMESPACE_NAME: datalayer.cloudmap.namespace.name,
		};

		const atlasfile = (
			kind: string,
			{ path, content }: (typeof ATLASFILE_PATHS)["routes"],
		) => {
			const stringcontent = JSON.stringify(content(dereferenced$));
			const object = new BucketObjectv2(_(`${name}-${kind}-atlas`), {
				bucket: s3.artifacts.bucket,
				source: new StringAsset(stringcontent),
				contentType: "application/json",
				key: `${name}/${path}`,
				tags: {
					Name: _(`${name}-${kind}-atlas`),
					StackRef: STACKREF_ROOT,
					PackageName: WORKSPACE_PACKAGE_NAME,
					Kind: "Monitor",
					Monitor: name,
					MonitorPackageName: packageName,
				},
			});

			const configuration = new ConfigurationProfile(
				_(`${name}-${kind}-config`),
				{
					applicationId: codestar.appconfig.application.id,
					description: `(${packageName}) ${name} "${kind}" atlasfile in #${stage}`,
					locationUri: "hosted",
					tags: {
						Name: _(`${name}-${kind}-config`),
						StackRef: STACKREF_ROOT,
						PackageName: WORKSPACE_PACKAGE_NAME,
						Kind: "Monitor",
						Monitor: name,
						MonitorPackageName: packageName,
					},
				},
				{
					dependsOn: object,
				},
			);

			const version = new HostedConfigurationVersion(
				_(`${name}-${kind}-config-version`),
				{
					applicationId: codestar.appconfig.application.id,
					configurationProfileId: configuration.configurationProfileId,
					description: `(${packageName}) ${name} "${kind}" atlasfile in #${stage}`,
					content: stringcontent,
					contentType: "application/json",
				},
				{
					dependsOn: configuration,
				},
			);

			const deployment = new Deployment(
				_(`${name}-${kind}-config-deployment`),
				{
					description: `(${packageName}) ${name} "${kind}" atlasfile in #${stage}`,
					applicationId: codestar.appconfig.application.id,
					environmentId: appconfig.environment.environmentId,
					configurationProfileId: configuration.configurationProfileId,
					configurationVersion: version.versionNumber.apply((v) => String(v)),
					deploymentStrategyId: context.environment.isProd
						? "AppConfig.Canary10Percent20Minutes"
						: "AppConfig.AllAtOnce",
					tags: {
						Name: _(`${name}-${kind}-config-deployment`),
						StackRef: STACKREF_ROOT,
						PackageName: WORKSPACE_PACKAGE_NAME,
						Kind: "Monitor",
						Monitor: name,
						MonitorPackageName: packageName,
					},
				},
				{
					dependsOn: version,
				},
			);

			return {
				object,
				content,
				configuration,
				version,
				deployment,
			};
		};

		const atlas = Object.fromEntries(
			Object.entries(ATLASFILE_PATHS).map(([named, { path, content }]) => [
				named,
				atlasfile(named, { path, content }),
			]),
		);
		const appconfigEnvironment = all([
			codestar.appconfig.application.name,
			appconfig.environment.name,
		]).apply(([applicationName, environmentName]) => {
			return {
				AWS_APPCONFIG_HOST: "http://localhost:2772",
				AWS_APPCONFIG_APPLICATION: applicationName,
				AWS_APPCONFIG_ENVIRONMENT: environmentName,
			};
		});
		const configpath = (file: keyof typeof ATLASFILE_PATHS) => {
			return all([appconfigEnvironment]).apply(([appconfigenvironment]) => {
				const applicationName = appconfigenvironment.AWS_APPCONFIG_APPLICATION;
				const environmentName = appconfigenvironment.AWS_APPCONFIG_ENVIRONMENT;
				return interpolate`/applications/${applicationName}/environments/${environmentName}/configurations/${atlas[file].configuration.name}`;
			});
		};
		const AWS_APPCONFIG_EXTENSION_PREFETCH_LIST = (() => {
			let prefetch = [];
			for (const af of Object.keys(atlas)) {
				if (af) {
					prefetch.push(af);
				}
			}
			return Output.create(
				prefetch.map((af) => configpath(af as keyof typeof ATLASFILE_PATHS)),
			);
		})().apply((list) => list.join(","));

		const memorySize = context.environment.isProd ? 512 : 256;
		const timeout = context.environment.isProd ? 93 : 55;
		const lambda = new LambdaFn(
			_(`${name}`),
			{
				description: `(${packageName}) "${description ?? `Monitor lambda ${name}`}" in #${stage}`,
				role: roleArn,
				architectures: ["arm64"],
				memorySize,
				timeout,
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
				layers: [
					// TODO: RIP mapping
					`arn:aws:lambda:us-west-2:359756378197:layer:AWS-AppConfig-Extension-Arm64:132`,
				],
				environment: all([cloudmapEnvironment, appconfigEnvironment]).apply(
					([cloudmapEnv, appconfigEnv]) => {
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
											LLRT_GC_THRESHOLD_MB: String(memorySize / 2),
										}
									: {}),
								...cloudmapEnv,
								...appconfigEnv,
								AWS_APPCONFIG_EXTENSION_PREFETCH_LIST,
								...(environment !== undefined &&
								typeof environment === "function"
									? Object.fromEntries(
											Object.entries(environment(dereferenced$))
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
					},
				),
				tags: {
					Name: _(name),
					StackRef: STACKREF_ROOT,
					PackageName: WORKSPACE_PACKAGE_NAME,
					Handler: "Monitor",
					Monitor: name,
					MonitorPackageName: packageName,
				},
			},
			{
				dependsOn: zip,
				ignoreChanges: ["handler", "s3Key", "s3ObjectVersion", "s3Bucket"],
			},
		);

		const version = new Version(_(`${name}-version`), {
			description: `(${packageName}) Version for ${stage}`,
			functionName: lambda.name,
		});

		const alias = new Alias(
			_(`${name}-alias`),
			{
				name: stage,
				description: `(${packageName}) Alias for ${stage}`,
				functionName: lambda.name,
				functionVersion: version.version,
			},
			{
				ignoreChanges: ["functionVersion"],
			},
		);

		const deploymentGroup = new DeploymentGroup(
			_(`${name}-deployment-group`),
			{
				deploymentGroupName: lambda.arn.apply((arn) =>
					_(`${name}-deploybg-${arn.slice(-5)}`),
				),
				appName: codestar.codedeploy.application.name,
				deploymentConfigName: codestar.codedeploy.deploymentConfig.name,
				serviceRoleArn: automationRole.arn,
				deploymentStyle: {
					deploymentOption: "WITH_TRAFFIC_CONTROL",
					deploymentType: "BLUE_GREEN",
				},
				tags: {
					Name: _("deployment-group"),
					StackRef: STACKREF_ROOT,
					PackageName: WORKSPACE_PACKAGE_NAME,
					Kind: "Monitor",
					Monitor: name,
					MonitorPackageName: packageName,
					Lambda: lambda.name,
					LambdaArn: lambda.arn,
					LambdaAlias: alias.name,
					LambdaVersion: version.version,
				},
			},
			{
				deleteBeforeReplace: true,
				dependsOn: [alias],
				replaceOnChanges: [
					"appName",
					"deploymentConfigName",
					"deploymentStyle",
				],
			},
		);

		// Codebuild
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
								[HANDLER_TYPE]: new CodeDeployAppspecResourceBuilder()
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
				const PIPELINE_STAGE = HANDLER_TYPE;
				const EXTRACT_ACTION = "extractimage" as const;
				const UPDATE_ACTION = "updatelambda" as const;

				const ATLAS_PIPELINE_VARIABLES = Object.fromEntries(
					Object.keys(ATLASFILE_PATHS).map(
						(name) =>
							[
								`ATLASFILE_${name.toUpperCase()}_KEY`,
								`<ATLASFILE_${name.toUpperCase()}_KEY>`,
							] as const,
					),
				);
				const { codeartifact, ssm } = $codestar;
				const stages = [
					{
						stage: PIPELINE_STAGE,
						action: EXTRACT_ACTION,
						artifact: {
							name: `${PIPELINE_STAGE}_${name}_${EXTRACT_ACTION}`,
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
							CANARY_NAME: "<CANARY_NAME>",
							PACKAGE_NAME: "<PACKAGE_NAME>",
							...ATLAS_PIPELINE_VARIABLES,
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
								{
									name: "CANARY_NAME",
									value: "<CANARY_NAME>",
									type: "PLAINTEXT",
								},
								{
									name: "PACKAGE_NAME",
									value: "<PACKAGE_NAME>",
									type: "PLAINTEXT",
								},
								...Object.keys(ATLAS_PIPELINE_VARIABLES).map((name) => ({
									name,
									value: `<${name}>`,
									type: "PLAINTEXT",
								})),
							] as { name: string; value: string; type: "PLAINTEXT" }[],
						},
						phases: {
							build: [
								"env",
								[
									"aws",
									"codeartifact",
									"get-authorization-token",
									"--domain",
									codeartifact.domain.name,
									"--domain-owner",
									codeartifact.domain.owner ?? "<DOMAIN_OWNER>",
									"--region $AWS_REGION",
									"--query authorizationToken",
									"--output text",
									" > .codeartifact-token",
								].join(" "),
								[
									"aws",
									"codeartifact",
									"get-repository-endpoint",
									"--domain",
									codeartifact.domain.name,
									"--domain-owner",
									codeartifact.domain.owner ?? "<DOMAIN_OWNER>",
									"--repository",
									codeartifact.repository.npm?.name,
									"--format npm",
									"--region $AWS_REGION",
									"--query repositoryEndpoint",
									"--output text",
									" > .codeartifact-repository",
								].join(" "),
								`export LEVICAPE_TOKEN=$(${[
									"aws",
									"ssm",
									"get-parameter",
									"--name",
									`"${ssm.levicape.npm.parameter.name}"`,
									"--with-decryption",
									"--region $AWS_REGION",
									"--query Parameter.Value",
									"--output text",
									"--no-cli-pager",
								].join(" ")})`,
								"docker --version",
								`aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $STACKREF_CODESTAR_ECR_REPOSITORY_URL`,
								"docker pull $SOURCE_IMAGE_URI",
								"docker images",
								"export NPM_REGISTRY=$(cat .codeartifact-repository)",
								// extract module
								[
									...[
										"docker run",
										...[
											"--detach",
											"--entrypoint deploy",
											`--env DEPLOY_FILTER=$PACKAGE_NAME`,
											`--env DEPLOY_OUTPUT=/tmp/${PIPELINE_STAGE}`,
											`--env DEPLOY_ARGS="--verify-store-integrity=false --node-linker=hoisted --prefer-offline"`,
											`--env NPM_REGISTRY`,
											`--env NPM_REGISTRY_HOST=\${NPM_REGISTRY#https://}`,
											`--env NPM_TOKEN=$(cat .codeartifact-token)`,
											`--env NPM_ALWAYS_AUTH=true`,
											`--env LEVICAPE_REGISTRY=${ssm.levicape.npm.url}`,
											`--env LEVICAPE_REGISTRY_HOST=${ssm.levicape.npm.host}`,
											`--env LEVICAPE_TOKEN`,
											`--env LEVICAPE_ALWAYS_AUTH=true`,
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
								`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/node_modules`,
								// bootstrap binary
								...(LLRT_ARCH
									? [
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
											`du -sh $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/bootstrap || true`,
											`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION} || true`,
											`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE} || true`,
										]
									: [
											`echo 'No bootstrap, removing ${OUTPUT_DIRECTORY}'`,
											`rm -rf $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/${OUTPUT_DIRECTORY} || true`,
											`ls -al $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE} || true`,
										]),
								// atlasfiles
								...Object.entries(ATLASFILE_PATHS).flatMap(
									([name, { path }]) => {
										const objectKey = `$ATLASFILE_${name.toUpperCase()}_KEY`;
										return [
											`echo "Rendering Atlasfile: ${name}"`,
											`echo "s3://${objectKey}"`,
											`aws s3 cp s3://${objectKey} $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/${path}`,
											`cat $CODEBUILD_SRC_DIR/.${EXTRACT_ACTION}/${PIPELINE_STAGE}/${path}`,
										];
									},
								),
								// deploy key
								`echo "Rendering deploy key to .deploykey"`,
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
								`export DeployKey=$(cat .deploykey)_$CANARY_NAME`,
								`echo $DeployKey`,
							] as string[],
						},
					},
					{
						stage: PIPELINE_STAGE,
						action: UPDATE_ACTION,
						artifact: {
							name: `${PIPELINE_STAGE}_${name}_${UPDATE_ACTION}`,
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
							LAMBDA_HANDLER: "<LAMBDA_HANDLER>",
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
									value: `${PIPELINE_STAGE}_${name}_${EXTRACT_ACTION}.DeployKey`,
									type: "PLAINTEXT",
								},
								{
									name: "LAMBDA_HANDLER",
									value: "<LAMBDA_HANDLER>",
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
									`--handler $LAMBDA_HANDLER`,
								].join(" "),
								"echo 'Waiting for update'",
								[
									"aws lambda wait function-updated",
									"--function-name $LAMBDA_FUNCTION_NAME",
									`--qualifier ${stage}`,
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

							const upload = new BucketObjectv2(
								_(`${artifact.name}-buildspec`),
								{
									bucket: s3.artifacts.bucket,
									content,
									key: `${artifact.name}/Buildspec.yml`,
								},
							);

							const project = new Project(
								_(`${artifact.name}`),
								{
									description: `(${packageName}) Deploy "${stage}" pipeline "${name}" stage: "${action}"`,
									buildTimeout: 12,
									serviceRole: automationRole.arn,
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
										PackageName: WORKSPACE_PACKAGE_NAME,
										Kind: "Monitor",
										Monitor: name,
										MonitorPackageName: packageName,
										DeployStage: stage,
										Action: action,
									},
								},
								{
									dependsOn: [upload, deploymentGroup],
								},
							);

							return [
								action,
								{
									project,
									pipeline: {
										stage,
										namespace: `ns_${stage}_${name}_${action}`,
									},
									buildspec: {
										artifact: `io_${artifact.name}`,
										content,
										upload,
									},
								},
							];
						},
					),
				);

				return entries as Record<
					(typeof stages)[number]["action"],
					{
						project: Project;
						pipeline: {
							stage: string;
							namespace: string;
						};
						buildspec: {
							artifact: string;
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

		return {
			role: datalayer.props.lambda.role,
			atlas,
			cloudwatch: {
				loggroup,
			},
			codedeploy: {
				application: codestar.codedeploy.application,
				deploymentGroup,
			},
			codebuild,
			environment: {
				CANARY_NAME: name,
				PACKAGE_NAME: packageName,
				LAMBDA_HANDLER: handler,
			},
			lambda: {
				arn: lambda.arn,
				name: lambda.name,
				alias,
				version,
			},
		} as const;
	};

	const deps = {
		datalayer: $datalayer,
		codestar: $codestar,
	} as const;

	const canary = await (async () => {
		return Object.fromEntries(
			await Promise.all(
				CANARY_PATHS.map(async (canary) => {
					return [
						canary.name,
						await handler(canary, deps, cloudwatch),
					] as const;
				}),
			),
		);
	})();

	const codepipeline = (() => {
		const randomid = new RandomId(_("deploy-id"), {
			byteLength: 4,
		});
		const pipelineName = _("deploy").replace(/[^a-zA-Z0-9_]/g, "-");
		const pipeline = new Pipeline(
			_("deploy"),
			{
				name: interpolate`${pipelineName}-${randomid.hex}`,
				pipelineType: "V2",
				roleArn: automationRole.arn,
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
								configuration: all([$codestar.ecr.repository.name]).apply(
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
						name: "MonitorHandler",
						actions: Object.entries(canary).flatMap(
							([
								name,
								{ codebuild, lambda, codedeploy, environment, atlas },
							]) => {
								return [
									{
										runOrder: 1,
										name: `${name}_ExtractImage`,
										namespace: codebuild.extractimage.pipeline.namespace,
										category: "Build",
										owner: "AWS",
										provider: "CodeBuild",
										version: "1",
										inputArtifacts: ["source_image"],
										outputArtifacts: [
											codebuild.extractimage.buildspec.artifact,
										],
										configuration: all([
											$codestar.ecr.repository.arn,
											$codestar.ecr.repository.name,
											$codestar.ecr.repository.url,
											codebuild.extractimage.project.name,
											s3.artifacts.bucket,
											Output.create([
												...Object.entries(atlas).map(([name, file]) => ({
													name: name.toUpperCase(),
													value: interpolate`${file.object.bucket}/${file.object.key}`,
												})),
											]),
										]).apply(
											([
												repositoryArn,
												repositoryName,
												repositoryUrl,
												projectExtractImageName,
												artifactBucketName,
												atlasfiles,
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
															value: artifactBucketName,
															type: "PLAINTEXT",
														},
														{
															name: "S3_DEPLOY_KEY",
															value: "#{SourceImage.ImageURI}",
															type: "PLAINTEXT",
														},
														{
															name: "CANARY_NAME",
															value: environment.CANARY_NAME,
															type: "PLAINTEXT",
														},
														{
															name: "PACKAGE_NAME",
															value: environment.PACKAGE_NAME,
															type: "PLAINTEXT",
														},
														...atlasfiles.map(({ name, value }) => ({
															name: `ATLASFILE_${name.toUpperCase()}_KEY`,
															value,
															type: "PLAINTEXT",
														})),
													]),
												};
											},
										),
									},
									{
										runOrder: 2,
										name: `${name}_UploadS3`,
										category: "Deploy",
										owner: "AWS",
										provider: "S3",
										version: "1",
										inputArtifacts: [codebuild.extractimage.buildspec.artifact],
										configuration: all([s3.artifacts.bucket]).apply(
											([BucketName]) => ({
												BucketName,
												Extract: "false",
												ObjectKey: `#{${codebuild.extractimage.pipeline.namespace}.DeployKey}`,
											}),
										),
									},
									{
										runOrder: 3,
										name: `${name}_UpdateLambda`,
										namespace: codebuild.updatelambda.pipeline.namespace,
										category: "Build",
										owner: "AWS",
										provider: "CodeBuild",
										version: "1",
										inputArtifacts: [codebuild.extractimage.buildspec.artifact],
										outputArtifacts: [
											codebuild.updatelambda.buildspec.artifact,
										],
										configuration: all([
											codebuild.updatelambda.project.name,
											lambda.name,
											lambda.alias.name,
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
															value: `#{${codebuild.extractimage.pipeline.namespace}.DeployKey}`,
															type: "PLAINTEXT",
														},
														{
															name: "LAMBDA_HANDLER",
															value: `${codebuild.extractimage.pipeline.stage}/${environment.LAMBDA_HANDLER}`,
															type: "PLAINTEXT",
														},
													]),
												};
											},
										),
									},
									{
										runOrder: 4,
										name: `${name}_Cutover`,
										category: "Deploy",
										owner: "AWS",
										provider: "CodeDeploy",
										version: "1",
										inputArtifacts: [codebuild.updatelambda.buildspec.artifact],
										configuration: all([
											$codestar.codedeploy.application.name,
											codedeploy.deploymentGroup.deploymentGroupName,
										]).apply(([applicationName, deploymentGroupName]) => {
											return {
												ApplicationName: applicationName,
												DeploymentGroupName: deploymentGroupName,
											};
										}),
									},
								];
							},
						),
					},
				],
				tags: {
					Name: _("deploy"),
					StackRef: STACKREF_ROOT,
					PackageName: WORKSPACE_PACKAGE_NAME,
				},
			},
			{
				dependsOn: Object.values(canary).flatMap((canary) => [
					canary.codebuild.updatelambda.project,
					canary.codebuild.extractimage.project,
					canary.codedeploy.deploymentGroup,
				]),
			},
		);

		return {
			pipeline,
		};
	})();

	// Eventbridge will trigger on ecr push
	const eventbridge = (() => {
		const { name } = $codestar.ecr.repository;

		const EcrImageAction = (() => {
			const rule = new EventRule(
				_("on-ecr-push"),
				{
					description: `(${WORKSPACE_PACKAGE_NAME}) ECR image deploy pipeline trigger for tag "${stage}"`,
					state: "ENABLED",
					eventPattern: JSON.stringify({
						source: ["aws.ecr"],
						"detail-type": ["ECR Image Action"],
						detail: {
							"repository-name": [name],
							"action-type": ["PUSH"],
							result: ["SUCCESS"],
							"image-tag": [stage],
						},
					}),
					tags: {
						Name: _(`on-ecr-push`),
						StackRef: STACKREF_ROOT,
					},
				},
				{
					deleteBeforeReplace: true,
				},
			);

			const target = new EventTarget(
				_("on-ecr-push-deploy"),
				{
					rule: rule.name,
					arn: codepipeline.pipeline.arn,
					roleArn: automationRole.arn,
				},
				{
					deleteBeforeReplace: true,
				},
			);

			return {
				targets: {
					pipeline: {
						rule,
						target,
					},
				},
			};
		})();

		// Max 5 targets per rule
		let groups = Object.entries(canary)
			.reduce(
				(acc, key) => {
					const [name, handler] = key;
					let last = acc[acc.length - 1];
					if (last.length === 5) {
						last = [];
						acc.push(last);
					}
					last.push([name, handler.lambda]);

					return acc;
				},
				[[]] as Array<[string, typeof canary.register.lambda][]>,
			)
			.filter((group) => group.length > 0);

		const OnSchedule = (() => {
			const targets = Object.fromEntries(
				groups.flatMap((group, idx) => {
					const rule = new EventRule(
						_(`on-rate-${idx}`),
						{
							description: `(${WORKSPACE_PACKAGE_NAME}) Schedule rule for ${group
								.map(([key]) => key)
								.join(", ")}`,
							state: "ENABLED",
							scheduleExpression: `rate(${context.environment.isProd ? "4" : "12"} minutes)`,
							tags: {
								Name: _(`on-rate-${idx}`),
								StackRef: STACKREF_ROOT,
							},
						},
						{
							deleteBeforeReplace: true,
						},
					);

					return group.map(([key, handler]) => {
						const target = new EventTarget(
							_(`on-rate-${idx}-${key}`),
							{
								rule: rule.name,
								arn: handler.alias.arn,
							},
							{
								dependsOn: handler.alias,
								deleteBeforeReplace: true,
							},
						);

						const permission = new Permission(_(`on-rate-${idx}-${key}-iam`), {
							action: "lambda:InvokeFunction",
							principal: "events.amazonaws.com",
							sourceArn: rule.arn,
							function: handler.arn,
							qualifier: handler.alias.name,
						});

						return [key, { rule, target, permission }] as const;
					});
				}),
			) as Record<
				keyof typeof canary,
				{ target: EventTarget; permission: Permission; rule: EventRule }
			>;

			return {
				targets,
			};
		})();

		return {
			EcrImageAction,
			OnSchedule,
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

	const lambdaOutput = Output.create(canary).apply((canaries) => {
		return Object.fromEntries(
			Object.entries(canaries).map(([name, handler]) => {
				return [
					name,
					{
						role: all([handler.role.arn, handler.role.name]).apply(
							([arn, name]) => ({
								arn,
								name,
							}),
						),
						cloudwatch: all([
							handler.cloudwatch.loggroup.name,
							handler.cloudwatch.loggroup.arn,
						]).apply(([name, arn]) => ({
							logGroup: {
								name,
								arn,
							},
						})),
						monitor: all([
							handler.lambda.arn,
							handler.lambda.name,
							handler.lambda.version.version,
							handler.lambda.alias.arn,
							handler.lambda.alias.name,
							handler.lambda.alias.functionVersion,
						]).apply(
							([
								arn,
								lambdaName,
								version,
								aliasArn,
								aliasName,
								functionVersion,
							]) => ({
								arn,
								name: lambdaName,
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
					},
				];
			}),
		);
	});

	const codebuildOutput = Output.create(canary).apply((canaries) => {
		return Object.fromEntries(
			Object.entries(canaries).map(([name, handler]) => {
				return [
					name,
					Output.create(handler.codebuild).apply(
						(codebuild) =>
							Object.fromEntries(
								Object.entries(codebuild).map(([key, resources]) => {
									return [
										key,
										all([
											resources.project.arn,
											resources.project.name,
											resources.buildspec.upload.bucket,
											resources.buildspec.upload.key,
										]).apply(
											([projectArn, projectName, bucketName, bucketKey]) => ({
												buildspec: {
													artifact: resources.buildspec.artifact,
													bucket: bucketName,
													key: bucketKey,
												},
												pipeline: {
													stage: resources.pipeline.stage,
													namespace: resources.pipeline.namespace,
												},
												project: {
													arn: projectArn,
													name: projectName,
												},
											}),
										),
									];
								}),
							) as Record<
								keyof typeof handler.codebuild,
								Output<{
									buildspec: {
										artifact: string;
										bucket: string;
										key: string;
									};
									pipeline: {
										stage: string;
										namespace: string;
									};
									project: { arn: string; name: string };
								}>
							>,
					),
				];
			}),
		);
	});

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
							Output.create(value.targets).apply(
								(targets) =>
									Object.fromEntries(
										Object.entries(targets).map(([key, event]) => {
											return [
												key,
												all([
													event.rule.arn,
													event.rule.name,
													event.target.arn,
													event.target.targetId,
												]).apply(
													([ruleArn, ruleName, targetArn, targetId]) => ({
														rule: {
															arn: ruleArn,
															name: ruleName,
														},
														target: {
															arn: targetArn,
															id: targetId,
														},
													}),
												),
											];
										}),
									) as Record<
										keyof typeof value.targets,
										Output<{
											rule: { arn: string; name: string };
											target: { arn: string; id: string };
										}>
									>,
							) as Record<
								keyof typeof value.targets,
								Output<{
									rule: { arn: string; name: string };
									target: { arn: string; id: string };
								}>
							>,
						]).apply((targets) => ({
							targets,
						})),
					];
				}),
			) as unknown as Record<
				keyof typeof eventbridge,
				Output<{
					targets: Record<
						keyof (typeof eventbridge)[keyof typeof eventbridge],
						{
							rule: { arn: string; name: string };
							target: { arn: string; id: string };
						}
					>;
				}>
			>;
		},
	);

	return all([
		s3Output,
		cloudwatchOutput,
		lambdaOutput,
		codebuildOutput,
		codepipelineOutput,
		eventbridgeRulesOutput,
	]).apply(
		([
			fourtwo_panel_monitor_s3,
			fourtwo_panel_monitor_cloudwatch,
			fourtwo_panel_monitor_lambda,
			fourtwo_panel_monitor_codebuild,
			fourtwo_panel_monitor_codepipeline,
			fourtwo_panel_monitor_eventbridge,
		]) => {
			const exported = {
				fourtwo_panel_monitor_imports: {
					[FourtwoApplicationRoot]: {
						codestar: $codestar,
						datalayer: $datalayer,
						panel_http: dereferenced$[FourtwoPanelHttpStackrefRoot],
						panel_web: dereferenced$[FourtwoPanelWebStackrefRoot],
					},
				},
				fourtwo_panel_monitor_s3,
				fourtwo_panel_monitor_cloudwatch,
				fourtwo_panel_monitor_lambda,
				fourtwo_panel_monitor_codebuild,
				fourtwo_panel_monitor_codepipeline,
				fourtwo_panel_monitor_eventbridge,
			} satisfies z.infer<typeof FourtwoPanelMonitorStackExportsZod> & {
				fourtwo_panel_monitor_imports: {
					[FourtwoApplicationRoot]: {
						codestar: typeof $codestar;
						datalayer: typeof $datalayer;
						panel_http: (typeof dereferenced$)[typeof FourtwoPanelHttpStackrefRoot];
						panel_web: (typeof dereferenced$)[typeof FourtwoPanelWebStackrefRoot];
					};
				};
			};

			const validate = FourtwoApplicationStackExportsZod.safeParse(exported);
			if (!validate.success) {
				error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
				warn(inspect(exported, { depth: null }));
			}
			return exported;
		},
	);
};
