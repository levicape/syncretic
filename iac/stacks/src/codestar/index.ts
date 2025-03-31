import { env } from "node:process";
import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Application as AppconfigApplication } from "@pulumi/aws/appconfig";
import {
	Domain,
	Repository,
	type RepositoryArgs,
	RepositoryPermissionsPolicy,
} from "@pulumi/aws/codeartifact";
import { DomainPermissions } from "@pulumi/aws/codeartifact/domainPermissions";
import { Application } from "@pulumi/aws/codedeploy";
import { DeploymentConfig } from "@pulumi/aws/codedeploy/deploymentConfig";
import { Repository as ECRRepository, LifecyclePolicy } from "@pulumi/aws/ecr";
import { getLifecyclePolicyDocument } from "@pulumi/aws/ecr/getLifecyclePolicyDocument";
import { RepositoryPolicy } from "@pulumi/aws/ecr/repositoryPolicy";
import { getPolicyDocumentOutput } from "@pulumi/aws/iam/getPolicyDocument";
import { Parameter, type ParameterArgs } from "@pulumi/aws/ssm/parameter";
import { error, warn } from "@pulumi/pulumi/log";
import { Output, all, interpolate } from "@pulumi/pulumi/output";
import { RandomId } from "@pulumi/random/RandomId";
import type { z } from "zod";
import { objectEntries, objectFromEntries } from "../Object";
import { $deref } from "../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../application/exports";
import { FourtwoCodestarStackExportsZod } from "./exports.ts";

const PACKAGE_NAME = "@levicape/fourtwo" as const;
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

	// Resources
	const ecr = await (async () => {
		const repository = new ECRRepository(_("binaries"), {
			tags: {
				Name: _("binaries"),
				PackageName: PACKAGE_NAME,
			},
		});

		const taggedTtl = context.environment.isProd ? 28 : 7;
		const untaggedTtl = context.environment.isProd ? 14 : 3;

		new LifecyclePolicy(_("binaries-lifecycle"), {
			repository: repository.name,
			policy: repository.repositoryUrl.apply(
				async () =>
					(
						await getLifecyclePolicyDocument({
							rules: [
								{
									priority: 1,
									description: `Expire images older than ${taggedTtl} days`,
									selection: {
										tagStatus: "tagged",
										countType: "sinceImagePushed",
										countUnit: "days",
										countNumber: taggedTtl,
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
										countNumber: untaggedTtl,
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

	const codeartifact = (() => {
		// Create a CodeArtifact Domain
		const domainId = new RandomId(_(`codeartifact-id`), {
			byteLength: 4,
		});

		const domainName = _("codeartifact").replace(/[^a-zA-Z0-9]/g, "-");
		const domain = new Domain(_(`codeartifact`), {
			domain: interpolate`${domainName}-${domainId.hex}`,
			tags: {
				Name: _(`codeartifact`),
				PackageName: PACKAGE_NAME,
			},
		});

		new DomainPermissions(_("codeartifact-policy"), {
			domain: domain.domain,
			domainOwner: domain.owner,
			policyDocument: getPolicyDocumentOutput({
				statements: [
					{
						effect: "Allow",
						principals: [
							{
								type: "Service",
								identifiers: [
									"codebuild.amazonaws.com",
									"codedeploy.amazonaws.com",
									"codepipeline.amazonaws.com",
									"lambda.amazonaws.com",
								],
							},
						],
						actions: [
							"codeartifact:Describe*",
							"codeartifact:Get*",
							"codeartifact:List*",
							"codeartifact:ReadFromRepository",
						],
						resources: ["*"],
					},
				],
			}).apply((policy) => policy.json),
		});

		const repository = async (
			name: string,
			config?: Omit<RepositoryArgs, "domain" | "repository">,
		) => {
			const repositoryId = new RandomId(_(`repository-${name}-id`), {
				byteLength: 4,
			});
			const repositoryName = _(`repository-${name}`).replace(
				/[^a-zA-Z0-9]/g,
				"-",
			);
			const repository = new Repository(_(`repository-${name}`), {
				repository: interpolate`${repositoryName}-${repositoryId.hex}`,
				domain: domain.domain,
				tags: {
					Name: _(`repository-${name}`),
					RepositoryName: repositoryName,
					DomainName: domain.domain,
					DomainOwner: domain.owner,
					PackageName: PACKAGE_NAME,
				},
				...config,
			});

			new RepositoryPermissionsPolicy(_(`repository-${name}-policy`), {
				repository: repository.repository,
				domain: repository.domain,
				domainOwner: repository.domainOwner,
				policyDocument: getPolicyDocumentOutput({
					statements: [
						{
							effect: "Allow",
							principals: [
								{
									type: "*",
									identifiers: ["*"],
								},
							],
							actions: [
								"codeartifact:ReadFromRepository",
								"codeartifact:DescribePackageVersion",
								"codeartifact:DescribeRepository",
								"codeartifact:GetPackageVersionReadme",
								"codeartifact:GetRepositoryEndpoint",
								"codeartifact:ListPackageVersionAssets",
								"codeartifact:ListPackageVersionDependencies",
								"codeartifact:ListPackageVersions",
								"codeartifact:ListPackages",
							],
							resources: ["*"],
						},
					],
				}).apply((policy) => policy.json),
			});

			return repository;
		};

		return {
			domain: domain,
			repository: {
				npm: repository("npm-upstream", {
					description: `(${PACKAGE_NAME}) NPM external connection for ${context.prefix}`,
					externalConnections: {
						externalConnectionName: "public:npmjs",
					},
				}),
			},
		};
	})();

	const codedeploy = await (async () => {
		const application = new Application(_("codedeploy"), {
			computePlatform: "Lambda",
			tags: {
				Name: _("codedeploy"),
				PackageName: PACKAGE_NAME,
			},
		});

		const deploymentConfig = new DeploymentConfig(_("deployment-config"), {
			computePlatform: "Lambda",
			trafficRoutingConfig: context.environment.isProd
				? {
						type: "TimeBasedLinear",
						timeBasedLinear: {
							interval: 3,
							percentage: 24,
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

	const appconfig = (() => {
		const application = new AppconfigApplication(_("appconfig"), {
			description: `(${PACKAGE_NAME}) Appconfig registry for ${context.prefix}`,
			tags: {
				Name: _("appconfig"),
				PackageName: PACKAGE_NAME,
			},
		});

		return {
			application,
		};
	})();

	const systemsmanager = (() => {
		const secret = (
			name: string,
			value: string,
			config: Omit<ParameterArgs, "name" | "value" | "type"> = {},
		) => {
			return new Parameter(_(`ssm-${name}`), {
				...config,
				type: "SecureString",
				value,
				tags: {
					Name: _(`ssm-${name}`),
					PackageName: PACKAGE_NAME,
				},
			});
		};

		const levicape = (() => {
			let host =
				env["NPM_REGISTRY_HOST_LEVICAPE"] ?? "<NPM_REGISTRY_HOST_LEVICAPE>";
			host = host.endsWith("/") ? host : `${host}/`;
			return {
				npm: {
					protocol:
						env["NPM_REGISTRY_PROTOCOL_LEVICAPE"] ??
						"<NPM_REGISTRY_PROTOCOL_LEVICAPE>",
					host,
					url: `${env["NPM_REGISTRY_PROTOCOL_LEVICAPE"]}://${host}`,
					parameter: secret(
						"levicape-npm",
						env["NPM_TOKEN_LEVICAPE"] ?? "<NPM_TOKEN_LEVICAPE>",
						{
							description: "levicape npm",
						},
					),
				},
			};
		})();

		return {
			levicape,
		};
	})();

	// Outputs
	const ecrOutput = all([
		ecr.repository.arn,
		ecr.repository.repositoryUrl,
		ecr.repository.name,
	]).apply(([arn, url, name]) => ({
		repository: {
			arn,
			url,
			name,
		},
	}));

	const codedeployOutput = all([
		codedeploy.application.arn,
		codedeploy.application.name,
		codedeploy.deploymentConfig.arn,
		codedeploy.deploymentConfig.deploymentConfigName,
	]).apply(([arn, name, deploymentConfigArn, deploymentConfigName]) => ({
		application: {
			arn,
			name,
		},
		deploymentConfig: {
			arn: deploymentConfigArn,
			name: deploymentConfigName,
		},
	}));
	const appconfigOutput = all([
		appconfig.application.arn,
		appconfig.application.id,
		appconfig.application.name,
	]).apply(([arn, id, name]) => ({
		application: {
			arn,
			id,
			name,
		},
	}));

	const codeartifactOutput = Output.create(codeartifact).apply(
		({ domain, repository }) => {
			const repositoryOutput = Output.create(
				objectFromEntries(
					objectEntries(repository).map(([key, value]) => [
						key,
						all([
							value.arn,
							value.repository,
							value.description,
							value.administratorAccount,
							value.domainOwner,
							value.externalConnections,
							value.upstreams,
						]).apply(
							([
								arn,
								repository,
								description,
								administratorAccount,
								domainOwner,
								externalConnections,
								upstreams,
							]) => ({
								arn,
								name: repository,
								description,
								administratorAccount,
								domainOwner,
								externalConnections,
								upstreams,
							}),
						),
					]),
				),
			);

			return all([
				domain.arn,
				domain.domain,
				domain.owner,
				domain.s3BucketArn,
				repositoryOutput,
			]).apply(([domainArn, domainName, domainOwner, domainS3BucketArn]) => ({
				domain: {
					arn: domainArn,
					name: domainName,
					owner: domainOwner,
					s3BucketArn: domainS3BucketArn,
				},
				repository: repositoryOutput,
			}));
		},
	);

	const ssmOutput = all([
		systemsmanager.levicape.npm.url,
		systemsmanager.levicape.npm.host,
		systemsmanager.levicape.npm.parameter.arn,
		systemsmanager.levicape.npm.parameter.name,
		systemsmanager.levicape.npm.parameter.type,
		systemsmanager.levicape.npm.parameter.description,
		systemsmanager.levicape.npm.parameter.keyId,
		systemsmanager.levicape.npm.parameter.version,
	]).apply(([url, host, arn, name, type, description, keyId, version]) => ({
		levicape: {
			npm: {
				url,

				host,
				parameter: {
					arn,
					name,
					type,
					description,
					keyId,
					version,
				},
			},
		},
	}));

	return all([
		ecrOutput,
		codedeployOutput,
		appconfigOutput,
		codeartifactOutput,
		ssmOutput,
	]).apply(([ecr, codedeploy, appconfig, codeartifact, ssm]) => {
		const exported = {
			fourtwo_codestar_ecr: ecr,
			fourtwo_codestar_codedeploy: codedeploy,
			fourtwo_codestar_appconfig: appconfig,
			fourtwo_codestar_codeartifact: codeartifact,
			fourtwo_codestar_ssm: ssm,
		} satisfies z.infer<typeof FourtwoCodestarStackExportsZod>;

		const validate = FourtwoCodestarStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
