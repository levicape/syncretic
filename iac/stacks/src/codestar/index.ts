import { Context } from "@levicape/fourtwo-pulumi";
import { Application } from "@pulumi/aws/codedeploy";
import { DeploymentConfig } from "@pulumi/aws/codedeploy/deploymentConfig";
import { Repository as ECRRepository, LifecyclePolicy } from "@pulumi/aws/ecr";
import { getLifecyclePolicyDocument } from "@pulumi/aws/ecr/getLifecyclePolicyDocument";
import { RepositoryPolicy } from "@pulumi/aws/ecr/repositoryPolicy";
import { all } from "@pulumi/pulumi/output";
import type { z } from "zod";
import { $deref } from "../Stack";
import { FourtwoApplicationStackExportsZod } from "../application/exports";
import { FourtwoCodestarStackExportsZod } from "./exports";

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? "fourtwo";
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		application: {
			refs: {
				servicecatalog:
					FourtwoApplicationStackExportsZod.shape
						.fourtwo_application_servicecatalog,
			},
		},
	},
};

export = async () => {
	// Stack references
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	const ecr = await (async () => {
		const repository = new ECRRepository(_("binaries"));

		const taggedTtl = context.environment.isProd ? 28 : 9;
		const untaggedTtl = context.environment.isProd ? 14 : 5;

		new LifecyclePolicy(_("binaries-lifecycle"), {
			repository: repository.name,
			policy: repository.repositoryUrl.apply(
				async () =>
					(
						await getLifecyclePolicyDocument({
							rules: [
								{
									priority: 1,
									description: "Expire images older than 14 days",
									selection: {
										tagStatus: "tagged",
										countType: "sinceImagePushed",
										countUnit: "days",
										countNumber: 14,
										tagPrefixLists: ["git"],
									},
									action: {
										type: "expire",
									},
								},
								{
									priority: 2,
									description: `Expire untagged images older than ${untaggedTtl} days`,
									selection: {
										tagStatus: "untagged",
										countType: "sinceImagePushed",
										countUnit: "days",
										countNumber: taggedTtl,
									},
									action: {
										type: "expire",
									},
								},
							],
						})
					).json,
			),
		});
		new RepositoryPolicy(_("binaries-policy"), {
			repository: repository.name,
			policy: repository.repositoryUrl.apply(() =>
				JSON.stringify({
					Version: "2008-10-17",
					Statement: [
						{
							Effect: "Allow",
							Principal: {
								Service: [
									"codebuild.amazonaws.com",
									"codedeploy.amazonaws.com",
									"codepipeline.amazonaws.com",
									"lambda.amazonaws.com",
								],
							},
							Action: [
								"ecr:GetDownloadUrlForLayer",
								"ecr:BatchGetImage",
								"ecr:BatchCheckLayerAvailability",
							],
						},
					],
				}),
			),
		});

		return {
			repository,
		};
	})();

	const codedeploy = await (async () => {
		const application = new Application(_("application"), {
			computePlatform: "Lambda",
		});

		const deploymentConfig = new DeploymentConfig(_("deployment-config"), {
			computePlatform: "Lambda",
			trafficRoutingConfig: context.environment.isProd
				? {
						type: "TimeBasedLinear",
						timeBasedLinear: {
							interval: 2,
							percentage: 12,
						},
					}
				: {
						type: "AllAtOnce",
					},
		});

		return {
			application,
			deploymentConfig,
		};
	})();

	return all([
		ecr.repository.arn,
		ecr.repository.repositoryUrl,
		ecr.repository.name,
		codedeploy.application.arn,
		codedeploy.application.name,
		codedeploy.deploymentConfig.arn,
		codedeploy.deploymentConfig.deploymentConfigName,
	]).apply(
		([
			ecrRepositoryArn,
			ecrRepositoryUrl,
			ecrRepositoryName,
			codedeployApplicationArn,
			codedeployApplicationName,
			codedeployDeploymentConfigArn,
			codedeployDeploymentConfigName,
		]) => {
			const exported = {
				fourtwo_codestar_ecr: {
					repository: {
						arn: ecrRepositoryArn,
						url: ecrRepositoryUrl,
						name: ecrRepositoryName,
					},
				},
				fourtwo_codestar_codedeploy: {
					application: {
						arn: codedeployApplicationArn,
						name: codedeployApplicationName,
					},
					deploymentConfig: {
						arn: codedeployDeploymentConfigArn,
						name: codedeployDeploymentConfigName,
					},
				},
			} satisfies z.infer<typeof FourtwoCodestarStackExportsZod>;

			const validate = FourtwoCodestarStackExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}

			return exported;
		},
	);
};
