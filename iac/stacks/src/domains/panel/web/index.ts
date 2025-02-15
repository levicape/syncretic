import {
	CodeBuildBuildspecArtifactsBuilder,
	CodeBuildBuildspecBuilder,
	CodeBuildBuildspecEnvBuilder,
	CodeBuildBuildspecResourceLambdaPhaseBuilder,
} from "@levicape/fourtwo-builders";
import { Context } from "@levicape/fourtwo-pulumi";
import { EventRule, EventTarget } from "@pulumi/aws/cloudwatch";
import { Project } from "@pulumi/aws/codebuild";
import { Pipeline } from "@pulumi/aws/codepipeline";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { getRole } from "@pulumi/aws/iam/getRole";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment";
import {
	Bucket,
	BucketLifecycleConfigurationV2,
	BucketServerSideEncryptionConfigurationV2,
} from "@pulumi/aws/s3";
import { BucketObjectv2 } from "@pulumi/aws/s3/bucketObjectv2";
import { BucketOwnershipControls } from "@pulumi/aws/s3/bucketOwnershipControls";
import { BucketPublicAccessBlock } from "@pulumi/aws/s3/bucketPublicAccessBlock";
import { BucketVersioningV2 } from "@pulumi/aws/s3/bucketVersioningV2";
import { BucketWebsiteConfigurationV2 } from "@pulumi/aws/s3/bucketWebsiteConfigurationV2";
import { type Output, all } from "@pulumi/pulumi";
import { stringify } from "yaml";
import type { z } from "zod";
import type { WebsiteManifest } from "../../../RouteMap";
import { $deref, type DereferencedOutput } from "../../../Stack";
import { FourtwoCodestarStackExportsZod } from "../../../codestar/exports";
import { FourtwoDatalayerStackExportsZod } from "../../../datalayer/exports";
import { FourtwoPanelHttpStackExportsZod } from "../http/exports";
import { FourtwoPanelWebStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo-panel-ui" as const;
const DEPLOY_DIRECTORY = "output/staticwww" as const;
const MANIFEST_PATH = "/_web/routemap.json" as const;

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
				iam: FourtwoDatalayerStackExportsZod.shape.fourtwo_datalayer_iam,
			},
		},
		["panel-http"]: {
			refs: {
				routemap:
					FourtwoPanelHttpStackExportsZod.shape.fourtwo_panel_http_routemap,
			},
		},
	},
};
const ROUTE_MAP = (
	stackrefs: DereferencedOutput<typeof STACKREF_CONFIG>[typeof STACKREF_ROOT],
) => {
	const { "panel-http": panel_http } = stackrefs;
	return {
		panel_http: panel_http.routemap,
	};
};

export = async () => {
	const context = await Context.fromConfig();
	const _ = (name?: string) =>
		name ? `${context.prefix}-${name}` : context.prefix;
	const stage = process.env.CI_ENVIRONMENT ?? "unknown";
	const farRole = await getRole({ name: "FourtwoAccessRole" });

	// Stack references
	const $dereference$ = await $deref(STACKREF_CONFIG);
	const { codestar, datalayer } = $dereference$;
	const routemap = ROUTE_MAP($dereference$);

	// Object Store
	const s3 = (() => {
		const bucket = (
			name: string,
			props: {
				daysToRetain?: number;
				www?: boolean;
			} = {
				daysToRetain: context.environment.isProd ? 30 : 8,
				www: false,
			},
		) => {
			const { daysToRetain, www } = props;
			const bucket = new Bucket(_(name), {
				acl: "private",
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
			new BucketVersioningV2(_(`${name}-versioning`), {
				bucket: bucket.bucket,
				versioningConfiguration: {
					status: "Enabled",
				},
			});

			let website: BucketWebsiteConfigurationV2 | undefined;
			if (www) {
				const bucketName = bucket.bucket;
				const publicAccessBlock = new BucketPublicAccessBlock(
					_(`${name}-public-access`),
					{
						bucket: bucketName,
						blockPublicAcls: false,
						blockPublicPolicy: false,
						ignorePublicAcls: false,
						restrictPublicBuckets: false,
					},
					{
						dependsOn: [bucket],
						replaceOnChanges: ["*"],
						deleteBeforeReplace: true,
					},
				);

				const ownershipControls = new BucketOwnershipControls(
					_(`${name}-ownership-controls`),
					{
						bucket: bucketName,
						rule: {
							objectOwnership: "ObjectWriter",
						},
					},
					{
						dependsOn: [bucket, publicAccessBlock],
					},
				);

				website = new BucketWebsiteConfigurationV2(
					_(`${name}-website`),
					{
						bucket: bucketName,
						indexDocument: {
							suffix: "index.html",
						},
						errorDocument: {
							key: "error.html",
						},
					},
					{
						dependsOn: [bucket, publicAccessBlock, ownershipControls],
					},
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
							id: "ExpireObjects",
							expiration: {
								days: daysToRetain,
							},
						},
					],
				});
			}

			return {
				bucket,
				website,
			};
		};
		return {
			artifactStore: bucket("artifact-store"),
			build: bucket("build"),
			staticwww: bucket("staticwww", { www: true }),
		};
	})();

	let manifest = (() => {
		const {
			stage,
			environment: { isProd },
			frontend,
		} = context;

		let content: Output<{ WebsiteComponent: WebsiteManifest }> | undefined;
		content = all([s3.staticwww.website?.websiteEndpoint ?? ""]).apply(
			([url]) => {
				const { dns } = frontend ?? {};
				const { hostnames } = dns ?? {};

				let allroutes = {
					...routemap.panel_http,
				} as const;

				return {
					WebsiteComponent: {
						manifest: {
							ok: true,
							routes: Object.fromEntries(
								Object.entries(allroutes).map(([key, value]) => {
									const { url, cdn, protocol } = value;
									const { service, instance, namespace } = value.cloudmap ?? {};

									return [
										key,
										{
											url,
											cdn,
											protocol,
											...(instance !== undefined
												? {
														cloudmap: {
															service: service?.name,
															instance: instance?.id,
															namespace: namespace?.name,
															attributes: instance?.attributes ?? {},
														},
													}
												: {}),
										},
									];
								}),
							),
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
								stage,
							},
						},
					} satisfies WebsiteManifest,
				};
			},
		);

		const upload = new BucketObjectv2(_("manifest-upload"), {
			bucket: s3.build.bucket.bucket,
			content: content.apply((c) => JSON.stringify(c, null, 2)),
			key: MANIFEST_PATH,
		});

		return {
			routemap: {
				content,
				upload,
			},
		};
	})();

	const codebuild = (() => {
		const deployStage = "staticwww";
		const deployAction = "extractimage";
		const artifactIdentifier = `${deployStage}_${deployAction}`;

		const buildspec = (() => {
			const content = stringify(
				new CodeBuildBuildspecBuilder()
					.setVersion("0.2")
					.setArtifacts(
						new CodeBuildBuildspecArtifactsBuilder()
							.setFiles(["**/*"])
							.setBaseDirectory(`.${deployAction}/${DEPLOY_DIRECTORY}`)
							.setName(artifactIdentifier),
					)
					.setEnv(
						new CodeBuildBuildspecEnvBuilder().setVariables({
							STACKREF_CODESTAR_ECR_REPOSITORY_ARN:
								"<STACKREF_CODESTAR_ECR_REPOSITORY_ARN>",
							STACKREF_CODESTAR_ECR_REPOSITORY_NAME:
								"<STACKREF_CODESTAR_ECR_REPOSITORY_NAME>",
							STACKREF_CODESTAR_ECR_REPOSITORY_URL:
								"<STACKREF_CODESTAR_ECR_REPOSITORY_URL>",
							SOURCE_IMAGE_REPOSITORY: "<SOURCE_IMAGE_REPOSITORY>",
							SOURCE_IMAGE_URI: "<SOURCE_IMAGE_URI>",
							S3_STATICWWW_BUCKET: "<S3_STATICWWW_BUCKET>",
						}),
					)
					.setPhases({
						build:
							new CodeBuildBuildspecResourceLambdaPhaseBuilder().setCommands([
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
									`-e DEPLOY_OUTPUT=/tmp/web`,
									"$SOURCE_IMAGE_URI",
									"> .container",
								].join(" "),
								"docker ps -al",
								"cat .container",
								"sleep 10s",
								`docker container logs $(cat .container)`,
								"sleep 10s",
								`docker container logs $(cat .container)`,
								`docker cp $(cat .container):/tmp/web $CODEBUILD_SRC_DIR/.${deployAction}`,
								`ls -al $CODEBUILD_SRC_DIR/.${deployAction} || true`,
								`ls -al $CODEBUILD_SRC_DIR/.${deployAction}/${DEPLOY_DIRECTORY} || true`,
								`du -sh $CODEBUILD_SRC_DIR/.${deployAction}/${DEPLOY_DIRECTORY} || true`,
								"aws s3 ls s3://$S3_STATICWWW_BUCKET",
							]),
					})
					.build(),
			);

			const upload = new BucketObjectv2(_("buildspec-upload"), {
				bucket: s3.build.bucket.bucket,
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
					description: `(${PACKAGE_NAME}) Deploy pipeline "${deployStage}" stage: "${deployAction}"`,
					buildTimeout: 14,
					serviceRole: farRole.arn,
					artifacts: {
						type: "CODEPIPELINE",
						artifactIdentifier,
					},
					environment: {
						type: "ARM_CONTAINER",
						computeType: "BUILD_GENERAL1_MEDIUM",
						image: "aws/codebuild/amazonlinux-aarch64-standard:3.0",
						environmentVariables: [
							{
								name: "STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
								value: codestar.ecr.repository.arn,
								type: "PLAINTEXT",
							},
							{
								name: "STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
								value: codestar.ecr.repository.name,
								type: "PLAINTEXT",
							},
							{
								name: "STACKREF_CODESTAR_ECR_REPOSITORY_URL",
								value: codestar.ecr.repository.url,
							},
							{
								name: "SOURCE_IMAGE_REPOSITORY",
								value: "SourceImage.RepositoryName",
								type: "PLAINTEXT",
							},
							{
								name: "SOURCE_IMAGE_URI",
								value: "SourceImage.ImageUri",
								type: "PLAINTEXT",
							},
							{
								name: "S3_STATICWWW_BUCKET",
								value: s3.staticwww.bucket.bucket,
								type: "PLAINTEXT",
							},
						],
					},
					source: {
						type: "CODEPIPELINE",
						buildspec: buildspec.content,
					},
					tags: {
						Name: _(artifactIdentifier),
						StackRef: STACKREF_ROOT,
						PackageName: PACKAGE_NAME,
						DeployStage: deployStage,
						Action: deployAction,
					},
				},
				{
					dependsOn: [buildspec.upload, s3.staticwww.bucket],
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

	const codepipeline = (() => {
		const pipeline = new Pipeline(_("deploy"), {
			pipelineType: "V2",
			roleArn: farRole.arn,
			executionMode: "QUEUED",
			artifactStores: [
				{
					location: s3.artifactStore.bucket.bucket,
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
							configuration: all([codestar.ecr.repository.name]).apply(
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
					name: "StaticWWW",
					actions: [
						{
							runOrder: 1,
							name: "ExtractImage",
							namespace: "StaticWWWExtractImage",
							category: "Build",
							owner: "AWS",
							provider: "CodeBuild",
							version: "1",
							inputArtifacts: ["source_image"],
							outputArtifacts: [codebuild.spec.artifactIdentifier],
							configuration: all([
								codestar.ecr.repository.arn,
								codestar.ecr.repository.name,
								codestar.ecr.repository.url,
								codebuild.project.name,
								s3.staticwww.bucket.bucket,
							]).apply(
								([
									repositoryArn,
									repositoryName,
									repositoryUrl,
									projectName,
									bucketName,
								]) => {
									return {
										ProjectName: projectName,
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
												name: "S3_STATICWWW_BUCKET",
												value: bucketName,
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
							namespace: "StaticWWWUploadS3",
							category: "Deploy",
							owner: "AWS",
							provider: "S3",
							version: "1",
							inputArtifacts: [codebuild.spec.artifactIdentifier],
							configuration: all([s3.staticwww.bucket.bucket]).apply(
								([BucketName]) => ({
									BucketName,
									Extract: "true",
									CannedACL: "public-read",
								}),
							),
						},
					],
				},
			],
			tags: {
				Name: _("deploy"),
				StackRef: STACKREF_ROOT,
				PackageName: PACKAGE_NAME,
			},
		});

		new RolePolicyAttachment(_("codepipeline-rolepolicy"), {
			policyArn: ManagedPolicy.CodePipeline_FullAccess,
			role: farRole.name,
		});

		return {
			pipeline,
		};
	})();

	// Eventbridge will trigger on ecr push
	const eventbridge = (() => {
		const { name } = codestar.ecr.repository;

		const rule = new EventRule(_("on-ecr"), {
			description: `(${PACKAGE_NAME}) ECR image deploy pipeline trigger for tag "${name}"`,
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
		});
		const pipeline = new EventTarget(_("on-ecr-deploy"), {
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

	return all([
		s3.artifactStore.bucket.bucket,
		s3.build.bucket.bucket,
		s3.staticwww.bucket.arn,
		s3.staticwww.bucket.bucket,
		s3.staticwww.bucket.bucketDomainName,
		s3.staticwww.website?.websiteEndpoint ?? "",
		s3.staticwww.website?.websiteDomain ?? "",
		codebuild.project.arn,
		codebuild.project.name,
		codepipeline.pipeline.arn,
		codepipeline.pipeline.name,
		eventbridge.EcrImageAction.rule.arn,
		eventbridge.EcrImageAction.rule.name,
		eventbridge.EcrImageAction.targets.pipeline.arn,
		eventbridge.EcrImageAction.targets.pipeline.targetId,
	]).apply(
		([
			artifactStoreBucket,
			buildBucket,
			webBucketArn,
			webBucketName,
			webBucketDomainName,
			webBucketWebsiteEndpoint,
			webBucketWebsiteDomain,
			codebuildProjectArn,
			codebuildProjectName,
			pipelineArn,
			pipelineName,
			eventRuleArn,
			eventRuleName,
			eventTargetArn,
			eventTargetId,
		]) => {
			const exported = {
				fourtwo_panel_web_imports: {
					fourtwo: {
						codestar,
						datalayer,
					},
				},
				fourtwo_panel_web_s3: {
					artifactStore: {
						bucket: artifactStoreBucket,
					},
					build: {
						bucket: buildBucket,
					},
					staticwww: {
						bucket: webBucketName,
						public: {
							arn: webBucketArn,
							domainName: webBucketDomainName,
							websiteEndpoint: webBucketWebsiteEndpoint,
							websiteDomain: webBucketWebsiteDomain,
						},
					},
				},
				fourtwo_panel_web_codebuild: {
					project: {
						arn: codebuildProjectArn,
						name: codebuildProjectName,
					},
				},
				fourtwo_panel_web_pipeline: {
					pipeline: {
						arn: pipelineArn,
						name: pipelineName,
					},
				},
				fourtwo_panel_web_eventbridge: {
					EcrImageAction: {
						rule: {
							arn: eventRuleArn,
							name: eventRuleName,
						},
						targets: {
							pipeline: {
								arn: eventTargetArn,
								targetId: eventTargetId,
							},
						},
					},
				},
			} satisfies z.infer<typeof FourtwoPanelWebStackExportsZod> & {
				fourtwo_panel_web_imports: {
					fourtwo: {
						codestar: typeof codestar;
						datalayer: typeof datalayer;
					};
				};
			};

			const validate = FourtwoPanelWebStackExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}

			return exported;
		},
	);
};
