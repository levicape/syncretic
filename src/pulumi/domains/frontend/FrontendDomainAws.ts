// import type { Certificate } from "@pulumi/aws/acm/index.js";
// import {
// 	Role,
// 	RolePolicy,
// 	RolePolicyAttachment,
// } from "@pulumi/aws/iam/index.js";
// import type { Record as R53Record, Zone } from "@pulumi/aws/route53/index.js";
// import type { Bucket } from "@pulumi/aws/s3/index.js";
// import type { ComponentResourceOptions } from "@pulumi/pulumi/index.js";
// // import type { BunComponentAws } from "component/compute/bun/BunComponentAws.Linux.js";
// // import type { BunComponentAwsAssetsState } from "component/compute/bun/aws/BunComponentAwsAssets.js";
// import { CdnComponentAws } from "../../component/cdn/CdnComponentAws.js";
// import type { NodejsComponentAws } from "../../component/compute/nodejs/NodejsComponentAws.js";
// import type { WebsiteComponentAws } from "../../component/website/WebsiteComponentAws.js";
// import type { LambdaRouteResource } from "../../component/website/WebsiteManifest.js";
// import { FrontendDomain, type FrontendDomainProps } from "./FrontendDomain.js";

// export interface FrontendDomainAwsProps
// 	extends FrontendDomainProps<
// 		LambdaRouteResource,
// 		BunComponentAws,
// 		WebsiteComponentAws
// 	> {
// 	protectCdn?: boolean;
// }

// export type FrontendDomainAwsState = {
// 	http: {
// 		assets: WebsiteComponentAws | BunComponentAwsAssetsState;
// 		compute?: NodejsComponentAws | BunComponentAws;
// 		cdn: CdnComponentAws;
// 		dns?: {
// 			zone: Zone;
// 			records: R53Record[];
// 			certificate?: Certificate;
// 		};
// 	};
// 	iam: {
// 		role: Role;
// 	};
// 	bucket?: Bucket;
// };

// const lambdaPolicyDocument = {
// 	Version: "2012-10-17",
// 	Statement: [
// 		{
// 			Effect: "Allow",
// 			Action: [
// 				"dynamodb:DescribeStream",
// 				"dynamodb:GetShardIterator",
// 				"dynamodb:ListStreams",
// 				"logs:CreateLogGroup",
// 				"logs:CreateLogStream",
// 				"logs:PutLogEvents",
// 			],
// 			Resource: "*",
// 		},
// 	],
// };

// export class FrontendDomainAws extends FrontendDomain<LambdaRouteResource> {
// 	static readonly URN = "@frontend:aws::domain";
// 	public readonly aws: FrontendDomainAwsState;

// 	constructor(
// 		name: string,
// 		props: FrontendDomainAwsProps,
// 		opts?: ComponentResourceOptions,
// 	) {
// 		super(FrontendDomainAws.URN, name, props, opts);

// 		const {
// 			build,
// 			context,
// 			routes,
// 			init,
// 			protectCdn = true,
// 			computePrefix,
// 		} = props;

// 		const { frontend } = context;

// 		if (!frontend || !frontend.dns) {
// 			throw new Error("Frontend not found in context");
// 		}

// 		this.aws = (() => {
// 			const {
// 				dns: { hostnames },
// 			} = frontend;

// 			const role = new Role(
// 				`${name}-lambda-role`,
// 				{
// 					assumeRolePolicy: JSON.stringify({
// 						Version: "2012-10-17",
// 						Statement: [
// 							{
// 								Effect: "Allow",
// 								Principal: {
// 									Service: "lambda.amazonaws.com",
// 								},
// 								Action: "sts:AssumeRole",
// 							},
// 						],
// 					}),
// 				},
// 				{ parent: this },
// 			);

// 			new RolePolicy(
// 				`${name}-lambda-policy`,
// 				{
// 					role: role.id,
// 					policy: JSON.stringify(lambdaPolicyDocument),
// 				},
// 				{ parent: this },
// 			);

// 			new RolePolicyAttachment(
// 				`${name}-lambda-policy-attachment`,
// 				{
// 					role: role.name,
// 					policyArn:
// 						"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
// 				},
// 				{ parent: this },
// 			);

// 			let assets: WebsiteComponentAws | BunComponentAwsAssetsState;
// 			let compute: BunComponentAws;
// 			if (build.$type === "docker" && init.$type === "docker") {
// 				assets = init.assets(build.assets, this, routes);
// 				compute = init.compute(
// 					build.compute,
// 					this,
// 					routes,
// 					assets.aws.bucket.bucketDomainName,
// 				);
// 			} else {
// 				if (build.$type !== "artifact" || init.$type !== "artifact") {
// 					throw new Error(`Either build.compute or build.artifact must be provided.
// Please verify: ${name}
// build: ${JSON.stringify(build)}
// init: ${JSON.stringify(init)}
// 					`);
// 				}

// 				compute = init.compute(build.compute, this, routes);
// 				if (compute.aws.assets === undefined) {
// 					throw new Error(
// 						`BunComponentAws assetPath is required for artifact builds.
// Please verify: ${name}
// build: ${JSON.stringify(build)}
// init: ${JSON.stringify(init)}
// 					`,
// 					);
// 				}
// 				assets = compute.aws.assets;
// 			}

// 			const cdn = new CdnComponentAws(
// 				`${name}-host`,
// 				{
// 					context,
// 					assets,
// 					compute,
// 					computePrefix: computePrefix,
// 					routes,
// 				},
// 				{
// 					parent: this,
// 					dependsOn: [
// 						compute,
// 						...(assets.$type === "WebsiteComponentAws"
// 							? [assets as WebsiteComponentAws]
// 							: []),
// 					],
// 					protect: protectCdn,
// 				},
// 			);

// 			return {
// 				http: {
// 					assets,
// 					compute,
// 					cdn,
// 				},
// 				iam: {
// 					role,
// 				},
// 			};
// 		})();

// 		this.registerOutputs({
// 			aws: this.aws,
// 		});
// 	}
// }
