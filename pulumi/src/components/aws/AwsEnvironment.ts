import type { Region } from "@pulumi/aws/index.js";

export type AwsEnvironment = {
	accountArn: string;
	accountId: string;
	region: Region;
};
