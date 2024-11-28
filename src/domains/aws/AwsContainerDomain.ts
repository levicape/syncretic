import { getLifecyclePolicyDocument } from "@pulumi/aws/ecr/getLifecyclePolicyDocument.js";
import {
	LifecyclePolicy,
	PullThroughCacheRule,
	Repository,
	RepositoryPolicy,
} from "@pulumi/aws/ecr/index.js";
import { getPolicyDocument } from "@pulumi/aws/iam/getPolicyDocument.js";
import type { Role } from "@pulumi/aws/iam/role.js";
import { getCallerIdentity, getPartition } from "@pulumi/aws/index.js";
import { Secret, SecretVersion } from "@pulumi/aws/secretsmanager/index.js";
import {
	ComponentResource,
	type ComponentResourceOptions,
	Output,
	all,
	jsonStringify,
} from "@pulumi/pulumi/index.js";
import { Static } from "@pulumiverse/time/index.js";
import type { Context } from "../../context/Context.js";
import type {
	DomainRegistry,
	DomainRegistryCredential,
} from "./DomainRegistryCredentials.js";

export interface AwsContainerDomainProps {
	context: Context;
	path: string;
	role: Role;
	// Enables caching for external registries (docker, ghcr, public.ecr.aws). Can only be enabled in one environment.
	globalCache?: boolean;
	credentials: {
		docker?: DomainRegistryCredential;
		ghcr?: DomainRegistryCredential;
	};
}

export type AwsContainerDomainState = {
	ecr: {
		repository: Repository;
		policy: RepositoryPolicy;
	};
};

/* eslint-disable */
const PROTECT_LOCK = true;
let GLOBAL_CACHE: string | undefined = undefined;
/* eslint-enable */

export class AwsContainerDomain extends ComponentResource {
	static readonly URN = "@aws:container::domain";
	public readonly ecr: AwsContainerDomainState["ecr"];

	constructor(
		name: string,
		{ context, path, globalCache, role, credentials }: AwsContainerDomainProps,
		opts?: ComponentResourceOptions,
	) {
		super(AwsContainerDomain.URN, name, {}, opts);
		const { prefix } = context;

		if (GLOBAL_CACHE && globalCache) {
			throw new Error(
				`Global cache is already enabled by ${GLOBAL_CACHE}. Please disable global cache in ${name}.`,
			);
		}

		this.ecr = (() => {
			const current = getCallerIdentity({});
			const currentGetPartition = getPartition({});
			const repository = new Repository(
				`${name}--Repository`,
				{
					name: `${prefix}/${path}`,
				},
				{ parent: this, protect: PROTECT_LOCK },
			);

			const policy = new RepositoryPolicy(
				`${name}--Resource-Policy`,
				{
					repository: repository.name,
					policy: all([currentGetPartition, current, role.arn]).apply(
						([currentGetPartition, current, roleArn]) =>
							getPolicyDocument({
								statements: [
									{
										sid: "root",
										effect: "Allow",
										principals: [
											{
												type: "AWS",
												identifiers: [
													`arn:${currentGetPartition.partition}:iam::${current.accountId}:root`,
												],
											},
										],
										actions: ["ecr:*"],
									},
									{
										sid: "LambdaECRImageRetrievalPolicy",
										effect: "Allow",
										principals: [
											{
												type: "Service",
												identifiers: ["lambda.amazonaws.com"],
											},
											{
												type: "AWS",
												identifiers: [roleArn],
											},
										],
										actions: [
											"ecr:GetDownloadUrlForLayer",
											"ecr:BatchGetImage",
											"ecr:BatchCheckLayerAvailability",
										],
									},
								],
							}).then(({ json }: { json: string }) => {
								console.debug({
									AwsContainerDomain: { name, policy: { json } },
								});
								return json;
							}),
					),
				},
				{
					parent: repository,
				},
			);

			return {
				repository,
				policy,
			};
		})();

		const {
			environment: { isProd },
		} = context;
		const lifecycle = new LifecyclePolicy(`${name}--Lifecycle-Policy`, {
			repository: this.ecr.repository.name,
			policy: getLifecyclePolicyDocument({
				rules: [
					{
						priority: 1,
						description: "Expire images older than 14 days (90 in prod)",
						selection: {
							tagStatus: "any",
							countType: "sinceImagePushed",
							countUnit: "days",
							countNumber: isProd ? 90 : 14,
						},
						action: {
							type: "expire",
						},
					},
				] as const,
			}).then((policy: { json: string }) => policy.json),
		});

		new Static(
			`${name}-Static`,
			{},
			{ parent: this, replaceOnChanges: ["*"], deleteBeforeReplace: true },
		).unix.apply(() => {
			GLOBAL_CACHE = undefined;
		});

		let caches: PullThroughCacheRule[] = [];
		if (globalCache) {
			GLOBAL_CACHE = name;
			caches = (
				[
					["registry-1.docker.io", "docker", credentials.docker] as const,
					["ghcr.io", "ghcr", credentials.ghcr] as const,
					["public.ecr.aws", "ecr-public"] as const,
				] satisfies Array<
					| [string, DomainRegistry]
					| [string, DomainRegistry, DomainRegistryCredential | undefined]
				>
			).map(
				([upstreamRegistryUrl, shortname, credentials]) =>
					new PullThroughCacheRule(
						`${name}-${shortname}--Cache-Rule`,
						{
							ecrRepositoryPrefix: shortname,
							upstreamRegistryUrl,
							credentialArn:
								credentials !== undefined
									? Output.create(
											new Secret(
												`${name}-${shortname}--Secret`,
												{
													name: `ecr-pullthroughcache/${name}-${shortname}-secret`,
													description: `Secret for ${shortname} cache`,
												},
												{ parent: this.ecr.repository },
											),
										).apply((secret) => {
											new SecretVersion(
												`${name}-${shortname}--Secret-Version`,
												{
													secretId: secret.id,
													secretString: jsonStringify(credentials),
												},
												{ parent: this.ecr.repository },
											);
											return secret.arn;
										})
									: undefined,
						},
						{ parent: this },
					),
			);
		}

		this.registerOutputs({
			ecr: this.ecr,
			lifecycle,
			caches,
		});

		// this.iam = (() => {
		// 	const adminPolicy = new Policy(
		// 		`${prefix}_aws-iam-admin--policy-Policy`,
		// 		{
		// 			description: "Admin policy with full access",
		// 			policy: JSON.stringify({
		// 				Version: "2012-10-17",
		// 				Statement: [
		// 					{
		// 						Effect: "Allow",
		// 						Action: "*",
		// 						Resource: "*",
		// 					},
		// 				],
		// 			}),
		// 		},
		// 		{ parent: this },
		// 	);

		// 	const readonlyPolicy = new Policy(
		// 		`${prefix}_aws-iam-readonly--policy-Policy`,
		// 		{
		// 			description: "Read-only policy with view access",
		// 			policy: JSON.stringify({
		// 				Version: "2012-10-17",
		// 				Statement: [
		// 					{
		// 						Effect: "Allow",
		// 						Action: [
		// 							"s3:ListBucket",
		// 							"s3:GetObject",
		// 							"dynamodb:ListTables",
		// 							"dynamodb:DescribeTable",
		// 							"cloudfront:ListDistributions",
		// 							"cloudfront:GetDistribution",
		// 							"cloudfront:GetDistributionConfig",
		// 							"route53:ListHostedZones",
		// 							"route53:GetHostedZone",
		// 							"route53:ListResourceRecordSets",
		// 							"route53:GetChange",
		// 						],
		// 						Resource: "*",
		// 					},
		// 				],
		// 			}),
		// 		},
		// 		{ parent: this },
		// 	);

		// 	const adminUser = new User(
		// 		`${prefix}_aws-iam-admin--user-User`,
		// 		{},
		// 		{ parent: this },
		// 	);

		// 	const readonlyUser = new User(
		// 		`${prefix}_aws-iam-readonly--user-User`,
		// 		{},
		// 		{ parent: this },
		// 	);

		// 	new UserPolicy(
		// 		`${prefix}_aws-iam-admin--policy-attachment`,
		// 		{
		// 			user: adminUser.name,
		// 			policy: adminPolicy.policy,
		// 		},
		// 		{ parent: this },
		// 	);

		// 	new UserPolicy(
		// 		`${prefix}_aws-iam-readonly--policy-attachment`,
		// 		{
		// 			user: readonlyUser.name,
		// 			policy: readonlyPolicy.policy,
		// 		},
		// 		{ parent: this },
		// 	);

		// 	return {
		// 		user: {
		// 			admin: adminUser,
		// 			readonly: readonlyUser,
		// 		},
		// 		policy: {
		// 			admin: adminPolicy,
		// 			readonly: readonlyPolicy,
		// 		},
		// 	};
		// })();
	}
}
