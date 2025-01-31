import { z } from "zod";

export const FourtwoDatalayerStackExportsZod = z.object({
	fourtwo_datalayer_props: z.object({
		lambda: z.object({
			role: z.object({
				arn: z.string(),
				name: z.string(),
			}),
			fileSystemConfig: z.object({
				arn: z.string(),
				localMountPath: z.string(),
			}),
			vpcConfig: z.object({
				securityGroupIds: z.array(z.string()),
				subnetIds: z.array(z.string()),
			}),
		}),
	}),
	fourtwo_datalayer_ec2: z.object({
		vpc: z.object({
			vpcId: z.string(),
			subnetIds: z.string(),
		}),
		securitygroup: z.object({
			securityGroupId: z.string(),
		}),
	}),
	fourtwo_datalayer_efs: z.object({
		filesystem: z.object({
			arn: z.string(),
			kmsKeyId: z.string(),
			dnsName: z.string(),
			sizeInBytes: z.string(),
		}),
		accesspoint: z.object({
			arn: z.string(),
			rootDirectory: z.string(),
		}),
	}),
	fourtwo_datalayer_iam: z.object({
		roles: z.object({
			lambda: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
	}),
	fourtwo_datalayer_cloudmap: z.object({
		namespace: z.object({
			name: z.string(),
			arn: z.string(),
			id: z.string(),
			hostedZone: z.string(),
		}),
	}),
});
