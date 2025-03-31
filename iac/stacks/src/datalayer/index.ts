import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { SecurityGroup } from "@pulumi/aws/ec2/securityGroup";
import { AccessPoint } from "@pulumi/aws/efs/accessPoint";
import { FileSystem } from "@pulumi/aws/efs/fileSystem";
import { MountTarget } from "@pulumi/aws/efs/mountTarget";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { Role } from "@pulumi/aws/iam/role";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment";
import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery/privateDnsNamespace";
import { Vpc } from "@pulumi/awsx/ec2/vpc";
import { all } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import type { z } from "zod";
import { $deref } from "../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../application/exports";
import type { FourtwoDatalayerStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo";
const EFS_ROOT_DIRECTORY = "/fourtwo";
const EFS_MOUNT_PATH = "/mnt/efs";

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
	const ec2 = (() => {
		const vpc = new Vpc(
			_("vpc"),
			{
				enableDnsHostnames: true,
				enableDnsSupport: true,
				subnetStrategy: "Auto",
				numberOfAvailabilityZones: 3,
				natGateways: {
					strategy: "None",
				},
				tags: {
					Name: _("vpc"),
					PackageName: PACKAGE_NAME,
				},
			},
			{
				replaceOnChanges: ["numberOfAvailabilityZones"],
			},
		);
		const subnetIds = vpc.publicSubnetIds;
		const securitygroup = new SecurityGroup(
			_("security-group"),
			{
				vpcId: vpc.vpcId,
				ingress: [
					{
						fromPort: 0,
						toPort: 0,
						protocol: "-1",
						cidrBlocks: ["0.0.0.0/0"],
					},
				],
				egress: [
					{
						fromPort: 0,
						toPort: 0,
						protocol: "-1",
						cidrBlocks: ["0.0.0.0/0"],
					},
				],
				tags: {
					Name: _("security-group"),
					PackageName: PACKAGE_NAME,
				},
			},
			{
				parent: vpc,
			},
		);

		return {
			vpc,
			subnetIds,
			securitygroup,
		};
	})();

	const efs = (({ subnetIds, securitygroup }) => {
		const filesystem = new FileSystem(_("efs"), {
			throughputMode: "elastic",
			tags: {
				Name: _("efs"),
				PackageName: PACKAGE_NAME,
			},
		});

		const mounttargets = subnetIds.apply((subnetIds) => {
			return subnetIds.map((subnetId, i) => {
				return new MountTarget(
					_(`efs-mount-${i}`),
					{
						fileSystemId: filesystem.id,
						subnetId,
						securityGroups: [securitygroup.id],
					},
					{
						deleteBeforeReplace: true,
						replaceOnChanges: ["*"],
					},
				);
			});
		});

		const accesspoint = new AccessPoint(
			_("efs-access-point"),
			{
				fileSystemId: filesystem.id,
				rootDirectory: {
					path: EFS_ROOT_DIRECTORY,
					creationInfo: {
						ownerGid: 1000,
						ownerUid: 1000,
						permissions: "777",
					},
				},
				posixUser: {
					gid: 1000,
					uid: 1000,
				},
				tags: {
					Name: _("efs-access-point"),
					PackageName: PACKAGE_NAME,
				},
			},
			{
				dependsOn: mounttargets,
			},
		);

		return {
			filesystem,
			mounttargets,
			accesspoint,
		};
	})(ec2);

	const iam = (() => {
		const lambda = (() => {
			const role = new Role(_("lambda-role"), {
				description: `(${PACKAGE_NAME}) Lambda execution Role for ${context.prefix}`,
				assumeRolePolicy: JSON.stringify({
					Version: "2012-10-17",
					Statement: [
						{
							Effect: "Allow",
							Principal: {
								Service: [
									"apigateway.amazonaws.com",
									"athena.amazonaws.com",
									"cloudwatch.amazonaws.com",
									"dynamodb.amazonaws.com",
									"events.amazonaws.com",
									"firehose.amazonaws.com",
									"iam.amazonaws.com",
									"kinesis.amazonaws.com",
									"lambda.amazonaws.com",
									"logs.amazonaws.com",
									"s3.amazonaws.com",
									"s3-object-lambda.amazonaws.com",
									"sns.amazonaws.com",
									"sqs.amazonaws.com",
								],
							},
							Action: "sts:AssumeRole",
						},
					],
				}),
				// Inline Policy: Maximum 10,128 characters
				inlinePolicies: [
					{
						name: "LambdaExecutionPolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										// AWSLambdaBasicExecutionRole
										"logs:CreateLogGroup",
										"logs:CreateLogStream",
										"logs:PutLogEvents",
										// AWSLambdaVPCAccessExecutionRole
										"ec2:CreateNetworkInterface",
										"ec2:DescribeNetworkInterfaces",
										"ec2:DescribeSubnets",
										"ec2:DeleteNetworkInterface",
										"ec2:AssignPrivateIpAddresses",
										"ec2:UnassignPrivateIpAddresses",
										// AmazonElasticFileSystemClientReadWriteAccess
										"elasticfilesystem:ClientMount",
										"elasticfilesystem:ClientWrite",
										"elasticfilesystem:DescribeMountTargets",
										// AmazonS3ReadOnlyAccess
										"s3:Get*",
										"s3:List*",
										"s3:Describe*",
										"s3-object-lambda:Get*",
										"s3-object-lambda:List*",
									],
									Resource: "*",
								},
								{
									Effect: "Allow",
									Action: "iam:PassRole",
									Resource: "*",
									Condition: {
										StringEquals: {
											"iam:PassedToService": "lambda.amazonaws.com",
										},
									},
								},
							],
						}),
					},
					{
						name: "LambdaIdentityPolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										// AmazonSSMReadOnlyAccess
										"cognito-identity:Describe*",
										"cognito-identity:Get*",
										"cognito-identity:List*",
										"cognito-idp:Describe*",
										"cognito-idp:AdminGet*",
										"cognito-idp:AdminList*",
										"cognito-idp:List*",
										"cognito-idp:Get*",
										"cognito-sync:Describe*",
										"cognito-sync:Get*",
										"cognito-sync:List*",
										"iam:ListOpenIdConnectProviders",
										"iam:ListRoles",
										"sns:ListPlatformApplications",
									],
									Resource: "*",
								},
							],
						}),
					},
					{
						name: "LambdaServicePolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										// AmazonSSMReadOnlyAccess
										"ssm:Describe*",
										"ssm:Get*",
										"ssm:List*",
										// AWSCloudMapDiscoverInstanceAccess
										"servicediscovery:Discover*",
										// AWSXrayWriteOnlyAccess
										"xray:Put*",
										"xray:Get*",
										"kms:ListAliases",
									],
									Resource: "*",
								},
								{
									Effect: "Allow",
									Action: [
										"logs:DescribeLogStreams",
										"logs:GetLogEvents",
										"logs:FilterLogEvents",
									],
									Resource: "arn:aws:logs:*:*:log-group:/aws/lambda/*",
								},
							],
						}),
					},
					// LambdaDatastorePolicy -> Dynamodb, Sqs, Kinesis
					// Default policies are either full write or read only,
					// Inline policy can write but not create new tables, queues or topics
				],
				tags: {
					Name: _("lambda-role"),
					PackageName: PACKAGE_NAME,
				},
			});

			/**
			 *  Managed Policies
			 *  ---> SNS - additional statements wrt. notifications
			 */
			[["sns", ManagedPolicy.AmazonSNSReadOnlyAccess]].forEach(
				([policy, policyArn]) => {
					new RolePolicyAttachment(_(`lambda-role-policy-${policy}`), {
						role,
						policyArn,
					});
				},
			);

			return role;
		})();

		const automation = (() => {
			const role = new Role(_("automation-role"), {
				description: `(${PACKAGE_NAME}) Automation Role for ${context.prefix}`,
				assumeRolePolicy: JSON.stringify({
					Version: "2012-10-17",
					Statement: [
						{
							Effect: "Allow",
							Principal: {
								Service: [
									"codebuild.amazonaws.com",
									"codedeploy.amazonaws.com",
									"codepipeline.amazonaws.com",
									"events.amazonaws.com",
									"lambda.amazonaws.com",
									"servicediscovery.amazonaws.com",
								],
							},
							Action: "sts:AssumeRole",
						},
					],
				}),
				inlinePolicies: [
					{
						name: "AutomationExecutionPolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										"logs:CreateLogGroup",
										"logs:CreateLogStream",
										"logs:PutLogEvents",
										// AmazonS3FullAccess
										"s3:*",
										"s3-object-lambda:*",
										// AWSCodeBuildDeveloperAccess
										"codebuild:StartBuild",
										"codebuild:StopBuild",
										"codebuild:StartBuildBatch",
										"codebuild:StopBuildBatch",
										"codebuild:Retry*",
										"codebuild:BatchGet*",
										"codebuild:GetResourcePolicy",
										"codebuild:Describe*",
										"codebuild:List*",
										"codecommit:Get*",
										"codecommit:ListBranches",
										"cloudwatch:GetMetricStatistics",
										"logs:GetLogEvents",
										// AWSCodePipeline_FullAccess
										"codepipeline:*",
										"cloudformation:DescribeStacks",
										"cloudformation:List*",
										"cloudtrail:DescribeTrails",
										"codebuild:BatchGetProjects",
										"codebuild:CreateProject",
										"codebuild:List*",
										"codecommit:GetReferences",
										"codecommit:List*",
										"codedeploy:BatchGetDeploymentGroups",
										"codedeploy:List*",
										"ec2:Describe*",
										"ecr:DescribeRepositories",
										"ecs:List*",
										"elasticbeanstalk:Describe*",
										"iam:ListRoles",
										"iam:GetRole",
										"lambda:ListFunctions",
										"opsworks:Describe*",
										"sns:ListTopics",
										"codestar-notifications:List*",
										"states:ListStateMachines",
									],
									Resource: "*",
								},
							],
						}),
					},
					{
						name: "AutomationServicePolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										// AmazonSSMReadOnlyAccess
										"ssm:Describe*",
										"ssm:Get*",
										"ssm:List*",
										// AWSLambda_FullAccess
										"cloudwatch:ListMetrics",
										"cloudwatch:GetMetricData",
										"kms:Describe*",
										"kms:Get*",
										"kms:List*",
										"iam:Get*",
										"iam:List*",
										"lambda:*",
										"logs:DescribeLogGroups",
										"states:DescribeStateMachine",
										"states:ListStateMachines",
										"tag:GetResources",
										"xray:GetTraceSummaries",
										"xray:BatchGetTraces",
									],
									Resource: "*",
								},
								{
									Effect: "Allow",
									Action: "iam:PassRole",
									Resource: "*",
									Condition: {
										StringEquals: {
											"iam:PassedToService": "lambda.amazonaws.com",
										},
									},
								},
							],
						}),
					},
					{
						name: "AutomationRegistryPolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										// AWSCodeArtifactReadOnlyAccess
										"codeartifact:Describe*",
										"codeartifact:Get*",
										"codeartifact:List*",
										"codeartifact:ReadFromRepository",
										// AmazonEC2ContainerRegistryReadOnly
										"sts:GetServiceBearerToken",
										"ecr:Get*",
										"ecr:Describe*",
										"ecr:List*",
										"ecr:BatchCheckLayerAvailability",
										"ecr:BatchGetImage",
										"ecr-public:BatchCheckLayerAvailability",
										"ecr-public:Get*",
										"ecr-public:Describe*",
									],
									Resource: "*",
								},
								// AWSCodeArtifactReadOnlyAccess
								{
									Effect: "Allow",
									Action: "sts:GetServiceBearerToken",
									Resource: "*",
									Condition: {
										StringEquals: {
											"sts:AWSServiceName": "codeartifact.amazonaws.com",
										},
									},
								},
							],
						}),
					},

					{
						name: "AutomationEventsPolicyInline",
						policy: JSON.stringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: [
										// CloudWatchEventsReadOnlyAccess
										"events:Describe*",
										"events:List*",
										"events:TestEventPattern",
										"schemas:Describe*",
										"schemas:ExportSchema",
										"schemas:Get*",
										"schemas:List*",
										"schemas:SearchSchemas",
										"scheduler:Get*",
										"scheduler:List*",
										"pipes:DescribePipe",
										"pipes:List*",
									],
									Resource: "*",
								},
							],
						}),
					},
				],
				tags: {
					Name: _("automation-role"),
					PackageName: PACKAGE_NAME,
				},
			});

			/**
			 *  Managed Policies:
			 *  ---> CodeDeploy -  additional statements wrt. notifications
			 */
			(
				[
					["codedeploy", ManagedPolicy.AWSCodeDeployDeployerAccess],
					["codedeploy-lambda", ManagedPolicy.AWSCodeDeployRoleForLambda],
				] as const
			).forEach(([name, arn]) => {
				new RolePolicyAttachment(_(`automation-role-policy-${name}`), {
					role: role,
					policyArn: arn,
				});
			});

			return role;
		})();

		return {
			roles: {
				lambda,
				automation,
			},
		};
	})();

	const cloudmap = (({ vpc }) => {
		const cloudMapPrivateDnsNamespace = new PrivateDnsNamespace(_(`pdns`), {
			name: all([vpc.vpcId, efs.filesystem.id]).apply(([vpcid, efsid]) =>
				_(`pdns-${vpcid.slice(-4)}-${efsid.slice(-4)}`),
			),
			description: `(${PACKAGE_NAME}) Service mesh private DNS namespace`,
			vpc: vpc.vpcId,
			tags: {
				Name: _("pdns"),
				PackageName: PACKAGE_NAME,
			},
		});

		return {
			namespace: cloudMapPrivateDnsNamespace,
		};
	})(ec2);

	const props = (({ vpc, securitygroup }, { accesspoint }, { roles }) =>
		all([
			accesspoint.arn,
			vpc.privateSubnetIds,
			securitygroup.id,
			roles.lambda.arn,
			roles.lambda.name,
		]).apply(
			([
				accessPointArn,
				privateSubnetIds,
				securityGroupId,
				lambdaRoleArn,
				lambdaRoleName,
			]) => {
				const fileSystemConfig = {
					arn: accessPointArn,
					localMountPath: EFS_MOUNT_PATH,
				};

				const vpcConfig = {
					subnetIds: privateSubnetIds,
					securityGroupIds: [securityGroupId],
				};

				return JSON.stringify({
					lambda: {
						role: {
							arn: lambdaRoleArn,
							name: lambdaRoleName,
						},
						fileSystemConfig,
						vpcConfig,
					},
				});
			},
		))(ec2, efs, iam);

	return all([
		props,
		iam.roles.lambda.arn,
		iam.roles.lambda.name,
		iam.roles.automation.arn,
		iam.roles.automation.name,
		ec2.vpc.vpcId,
		ec2.subnetIds.apply((ids) => ids.join(",")),
		ec2.securitygroup.id,
		efs.filesystem.arn,
		efs.filesystem.kmsKeyId,
		efs.filesystem.dnsName,
		efs.filesystem.sizeInBytes.apply((size) =>
			size.map((s) => s.value).join(","),
		),
		efs.accesspoint.arn,
		efs.accesspoint.rootDirectory.path,
		cloudmap.namespace.name,
		cloudmap.namespace.arn,
		cloudmap.namespace.id,
		cloudmap.namespace.hostedZone,
	]).apply(
		([
			jsonProps,
			iamRoleLambdaArn,
			iamRoleLambdaName,
			iamRoleAutomationArn,
			iamRoleAutomationName,
			ec2VpcId,
			ec2SubnetIds,
			ec2SecurityGroupId,
			efsFilesystemArn,
			efsFilesystemKmsKeyId,
			efsFilesystemDnsName,
			efsFilesystemSizeInBytes,
			efsAccessPointArn,
			efsAccessPointRootDirectory,
			cloudmapNamespaceName,
			cloudmapNamespaceArn,
			cloudmapNamespaceId,
			cloudmapNamespaceHostedZone,
		]) => {
			const exported = {
				fourtwo_datalayer_props: JSON.parse(jsonProps),
				fourtwo_datalayer_iam: {
					roles: {
						lambda: {
							arn: iamRoleLambdaArn,
							name: iamRoleLambdaName,
						},
						automation: {
							arn: iamRoleAutomationArn,
							name: iamRoleAutomationName,
						},
					},
				},
				fourtwo_datalayer_ec2: {
					vpc: {
						vpcId: ec2VpcId,
						subnetIds: ec2SubnetIds,
					},
					securitygroup: {
						securityGroupId: ec2SecurityGroupId,
					},
				},
				fourtwo_datalayer_efs: {
					filesystem: {
						arn: efsFilesystemArn,
						kmsKeyId: efsFilesystemKmsKeyId,
						dnsName: efsFilesystemDnsName,
						sizeInBytes: efsFilesystemSizeInBytes,
					},
					accesspoint: {
						arn: efsAccessPointArn,
						rootDirectory: efsAccessPointRootDirectory,
					},
				},
				fourtwo_datalayer_cloudmap: {
					namespace: {
						name: cloudmapNamespaceName,
						arn: cloudmapNamespaceArn,
						id: cloudmapNamespaceId,
						hostedZone: cloudmapNamespaceHostedZone,
					},
				},
			} satisfies z.infer<typeof FourtwoDatalayerStackExportsZod>;

			const validate = FourtwoApplicationStackExportsZod.safeParse(exported);
			if (!validate.success) {
				error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
				warn(inspect(exported, { depth: null }));
			}
			return exported;
		},
	);
};
