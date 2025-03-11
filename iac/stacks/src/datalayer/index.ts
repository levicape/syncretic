import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { SecurityGroup } from "@pulumi/aws/ec2/securityGroup";
import { AccessPoint } from "@pulumi/aws/efs/accessPoint";
import { FileSystem } from "@pulumi/aws/efs/fileSystem";
import { MountTarget } from "@pulumi/aws/efs/mountTarget";
import { Role } from "@pulumi/aws/iam/role";
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
			return new Role(
				_("lambda-role"),
				{
					assumeRolePolicy: JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Principal: {
									Service: "lambda.amazonaws.com",
								},
								Action: "sts:AssumeRole",
							},
						],
					}),
				},
				{ parent: this },
			);
		})();

		return {
			roles: {
				lambda,
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
