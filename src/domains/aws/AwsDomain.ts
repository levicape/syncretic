import type {
	ConfigurationProfile,
	Deployment,
	DeploymentStrategy,
	Environment,
} from "@pulumi/aws/appconfig/index.js";
import type { Application } from "@pulumi/aws/applicationinsights/index.js";
import type { Budget } from "@pulumi/aws/budgets/index.js";
import {
	type AnomalyMonitor,
	type AnomalySubscription,
	CostAllocationTag,
} from "@pulumi/aws/costexplorer/index.js";
import type { Vpc } from "@pulumi/aws/ec2/index.js";
import { Policy, User, UserPolicy } from "@pulumi/aws/iam/index.js";
import { Group } from "@pulumi/aws/resourcegroups/index.js";
import type { Zone } from "@pulumi/aws/route53/index.js";
import { AppregistryApplication } from "@pulumi/aws/servicecatalog/index.js";
import type {
	PrivateDnsNamespace,
	PublicDnsNamespace,
} from "@pulumi/aws/servicediscovery/index.js";
import {
	ComponentResource,
	type ComponentResourceOptions,
} from "@pulumi/pulumi/index.js";
import { BudgetFactory } from "../../component/aws/BudgetFactory.js";
import { Context } from "../../context/Context.js";

export interface AwsDomainProps {
	context: Context;
}

export type AwsDomainState = {
	group: {
		stack: Group;
		data: Group;
		lambda: Group;
	};
	spend: {
		actual: {
			daily: Budget;
			monthly: Budget;
		};
		forecasted: {
			monthly: Budget;
		};
	};
	iam: {
		user: {
			admin: User;
			readonly: User;
		};
		policy: {
			admin: Policy;
			readonly: Policy;
		};
	};
	vpc: {
		public: Vpc;
		private: Vpc;
	};
	dns?: {
		zone: Zone;
		servicediscovery: {
			namespace: {
				public: PublicDnsNamespace;
				private: PrivateDnsNamespace;
			};
			service: {};
		};
	};
	cloudwatch?: {
		insights?: {
			lambda?: Application;
			s3?: Application;
			dynamo?: Application;
		};
	};
	appconfig?: {
		environment: Environment;
		deployment: {
			v0: Deployment;
			strategy: DeploymentStrategy;
			profile: ConfigurationProfile;
		};
	};
	appregistry: {
		application: AppregistryApplication;
	};
	costexplorer: {
		allocation: {
			tag: CostAllocationTag;
		};
		monitor?: AnomalyMonitor;
		subscription?: AnomalySubscription;
	};
};

/* eslint-disable */
const PROTECT_LOCK = true;
/* eslint-enable */

export class AwsDomain extends ComponentResource {
	static readonly URN = "@aws:*::domain";
	public readonly group: AwsDomainState["group"];
	public readonly spend: AwsDomainState["spend"];
	public readonly appregistry: AwsDomainState["appregistry"];
	public readonly iam: AwsDomainState["iam"];
	public readonly costexplorer: AwsDomainState["costexplorer"];

	constructor(
		name: string,
		{ context }: AwsDomainProps,
		opts?: ComponentResourceOptions,
	) {
		super(AwsDomain.URN, name, {}, opts);
		const { prefix } = context;

		this.group = {
			stack: new Group(
				`${prefix}_aws-group-stack--Group`,
				{
					resourceQuery: {
						type: "TAG_FILTERS_1_0",
						query: JSON.stringify({
							ResourceTypeFilters: ["AWS::AllSupported"],
							TagFilters: [{ Key: Context._PREFIX_TAG, Values: [prefix] }],
						}),
					},
				},
				{ parent: this },
			),
			data: new Group(
				`${prefix}_aws-group-data--Group`,
				{
					resourceQuery: {
						type: "TAG_FILTERS_1_0",
						query: JSON.stringify({
							ResourceTypeFilters: [
								"AWS::S3::Bucket",
								"AWS::DynamoDB::Table",
								"AWS::CloudFront::Distribution",
							],
							TagFilters: [{ Key: Context._PREFIX_TAG, Values: [prefix] }],
						}),
					},
				},
				{ parent: this },
			),
			lambda: new Group(
				`${prefix}_aws-group-lambda--Group`,
				{
					resourceQuery: {
						type: "TAG_FILTERS_1_0",
						query: JSON.stringify({
							ResourceTypeFilters: ["AWS::Lambda::Function"],
							TagFilters: [{ Key: Context._PREFIX_TAG, Values: [prefix] }],
						}),
					},
				},
				{ parent: this },
			),
		};

		this.appregistry = {
			application: new AppregistryApplication(
				`${prefix}_aws-appregistry--AppregistryApplication`,
				{},
				{ parent: this },
			),
		};

		this.spend = {
			actual: {
				daily: BudgetFactory.of(
					`${prefix}_aws-spend-actual--daily`,
					context,
					{
						timeUnit: "DAILY",
						limitAmount: "1",
						threshold: 1,
						notificationType: "ACTUAL",
					},
					{ parent: this },
				),
				monthly: BudgetFactory.of(
					`${prefix}_aws-spend-actual--monthly`,
					context,
					{
						timeUnit: "MONTHLY",
						limitAmount: "1",
						threshold: 3,
						notificationType: "ACTUAL",
					},
					{ parent: this },
				),
			},
			forecasted: {
				monthly: BudgetFactory.of(
					`${prefix}_aws-budget-forecasted--monthly`,
					context,
					{
						timeUnit: "MONTHLY",
						limitAmount: "2",
						threshold: 4,
						notificationType: "FORECASTED",
					},
					{ parent: this },
				),
			},
		};

		this.iam = (() => {
			const adminPolicy = new Policy(
				`${prefix}_aws-iam-admin--policy-Policy`,
				{
					description: "Admin policy with full access",
					policy: JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Action: "*",
								Resource: "*",
							},
						],
					}),
				},
				{ parent: this },
			);

			const readonlyPolicy = new Policy(
				`${prefix}_aws-iam-readonly--policy-Policy`,
				{
					description: "Read-only policy with view access",
					policy: JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Action: [
									"s3:ListBucket",
									"s3:GetObject",
									"dynamodb:ListTables",
									"dynamodb:DescribeTable",
									"cloudfront:ListDistributions",
									"cloudfront:GetDistribution",
									"cloudfront:GetDistributionConfig",
									"route53:ListHostedZones",
									"route53:GetHostedZone",
									"route53:ListResourceRecordSets",
									"route53:GetChange",
								],
								Resource: "*",
							},
						],
					}),
				},
				{ parent: this },
			);

			const adminUser = new User(
				`${prefix}_aws-iam-admin--user-User`,
				{},
				{ parent: this },
			);

			const readonlyUser = new User(
				`${prefix}_aws-iam-readonly--user-User`,
				{},
				{ parent: this },
			);

			new UserPolicy(
				`${prefix}_aws-iam-admin--policy-attachment`,
				{
					user: adminUser.name,
					policy: adminPolicy.policy,
				},
				{ parent: this },
			);

			new UserPolicy(
				`${prefix}_aws-iam-readonly--policy-attachment`,
				{
					user: readonlyUser.name,
					policy: readonlyPolicy.policy,
				},
				{ parent: this },
			);

			return {
				user: {
					admin: adminUser,
					readonly: readonlyUser,
				},
				policy: {
					admin: adminPolicy,
					readonly: readonlyPolicy,
				},
			};
		})();

		this.costexplorer = {
			allocation: {
				tag: new CostAllocationTag(
					`${prefix}_aws-cost-explorer-tag--CostAllocationTag`,
					{
						status: "Active",
						tagKey: Context._PREFIX_TAG,
					},
					{ parent: this },
				),
			},
		};
	}
}
