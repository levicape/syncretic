import { SecurityGroup } from "@pulumi/aws/ec2/securityGroup.js";
import { AccessPoint } from "@pulumi/aws/efs/accessPoint.js";
import { FileSystem, MountTarget } from "@pulumi/aws/efs/index.js";
import { Vpc } from "@pulumi/awsx/ec2/vpc.js";
import type { ComponentResource, Output } from "@pulumi/pulumi/index.js";

export type FsState = {
	props: {
		fileSystemConfig: {
			arn: Output<string>;
			localMountPath: string;
		};
		vpcConfig: {
			subnetIds: Output<string[]>;
			securityGroupIds: Output<string>[];
		};
	};
	vpc: Vpc;
};
export type FsProps = {
	name: string;
	filesystem: {
		path: string;
	};
	parent?: ComponentResource;
};
export const BunComponentAwsFilesystem = ({
	filesystem,
	name,
	parent,
}: FsProps): FsState => {
	const lambdaVpc = new Vpc(
		`${name}-Bun--vpc`,
		{
			enableDnsHostnames: true,
			enableDnsSupport: true,
			subnetStrategy: "Auto",
			numberOfAvailabilityZones: 3,
			natGateways: {
				strategy: "None",
			},
			tags: {
				Name: `${name}-Bun--vpc`,
			},
		},
		{
			parent,
			replaceOnChanges: ["numberOfAvailabilityZones"],
		},
	);

	const subnetIds = lambdaVpc.publicSubnetIds;
	const sgForLambda = new SecurityGroup(
		`${name}-Bun--sg`,
		{
			vpcId: lambdaVpc.vpcId,
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
		},
		{
			parent: lambdaVpc,
		},
	);

	const efsForLambda = new FileSystem(
		`${name}-Bun--efs`,
		{
			throughputMode: "elastic",
			tags: {
				Name: `${name}-Bun--efs`,
			},
		},
		{
			parent,
		},
	);

	const mount = subnetIds.apply((subnetIds) => {
		return subnetIds.map((subnetId, i) => {
			return new MountTarget(
				`${name}-Bun--mount-${i}`,
				{
					fileSystemId: efsForLambda.id,
					subnetId,
					securityGroups: [sgForLambda.id],
				},
				{
					parent,
					deleteBeforeReplace: true,
					replaceOnChanges: ["*"],
				},
			);
		});
	});

	const accessPointForLambda = new AccessPoint(
		`${name}-Bun--access-point`,
		{
			fileSystemId: efsForLambda.id,
			rootDirectory: {
				path: "/leaf",
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
		},
		{
			parent,
			dependsOn: mount,
		},
	);

	const fileSystemConfig = {
		arn: accessPointForLambda.arn,
		localMountPath: filesystem.path,
	};

	const vpcConfig = {
		subnetIds: lambdaVpc.privateSubnetIds,
		securityGroupIds: [sgForLambda.id],
	};

	console.dir({
		BunComponentAwsFilesystem: {
			name,
			fileSystemConfig,
			vpcConfig,
		},
	});

	return {
		props: {
			fileSystemConfig,
			vpcConfig,
		},
		vpc: lambdaVpc,
	};
};
