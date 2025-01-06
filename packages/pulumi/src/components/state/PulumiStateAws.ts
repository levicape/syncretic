import type { BucketV2 as BucketV2Type } from "@pulumi/aws/s3";
import type { ComponentResourceOptions, Inputs, Output } from "@pulumi/pulumi";

import { type GetCallerIdentityResult, getCallerIdentity } from "@pulumi/aws";
import { Key } from "@pulumi/aws/kms";
import {
	BucketPublicAccessBlock,
	BucketServerSideEncryptionConfigurationV2,
	BucketV2,
	BucketVersioningV2,
} from "@pulumi/aws/s3";
import {
	ComponentResource,
	getProject,
	getStack,
	output,
} from "@pulumi/pulumi";

import { AwsState } from "../aws/AwsState.js";

export class PulumiStateAws extends ComponentResource<{
	identity?: GetCallerIdentityResult;
}> {
	public readonly bucket: BucketV2Type;

	public readonly PULUMI_BACKEND_URL: Output<string>;
	public readonly PULUMI_SECRETS_PROVIDER: Output<string>;
	public readonly PulumiBackendLoginCommand: Output<string>;
	public readonly PulumiStackInitCommand: Output<string>;

	protected async initialize(args: Inputs) {
		const identity = await getCallerIdentity();
		return {
			identity: {
				accountId: identity.accountId,
				arn: identity.arn,
				id: identity.id,
				userId: identity.userId,
			},
		};
	}

	constructor(name: string, _?: {}, opts?: ComponentResourceOptions) {
		super(AwsState.URN, name, {}, opts);

		let data = output(this.getData());

		const awsAccountId = data.apply((data) => data.identity?.accountId);

		const project = getProject();
		const stack = getStack();
		const prefix = `${project}-pulumi-aws-state`;
		this.bucket = new BucketV2(
			`${prefix}-bucket`,
			{
				acl: "private",
			},
			{ parent: this },
		);
		const { id: bucket } = this.bucket;

		new BucketServerSideEncryptionConfigurationV2(
			`${prefix}-encryption`,
			{
				bucket,
				rules: [
					{
						applyServerSideEncryptionByDefault: {
							sseAlgorithm: "AES256",
						},
					},
				],
			},
			{ parent: this },
		);

		new BucketVersioningV2(
			`${prefix}-bucket-versioning`,
			{
				bucket,
				versioningConfiguration: {
					status: "Enabled",
				},
			},
			{ parent: this },
		);

		new BucketPublicAccessBlock(
			`${prefix}-bucket-public-block`,
			{
				bucket,
				blockPublicAcls: true,
				blockPublicPolicy: true,
				ignorePublicAcls: true,
				restrictPublicBuckets: true,
			},
			{ parent: this },
		);

		const { keyId } = new Key(
			`${prefix}-secrets-provider-encryption-key`,
			{
				deletionWindowInDays: 10,
				policy: JSON.stringify({
					Version: "2012-10-17",
					Statement: [
						{
							Sid: "Enable IAM policies",
							Effect: "Allow",
							Action: "kms:*",
							Principal: { AWS: [`arn:aws:iam::${awsAccountId}:root`] },
							Resource: "*",
						},
					],
				}),
			},
			{ parent: this },
		);

		this.PULUMI_BACKEND_URL = bucket.apply(
			(bucket: string) => `s3://${bucket}`,
		);
		this.PULUMI_SECRETS_PROVIDER = keyId.apply(
			(keyId: string) => `awskms:///${keyId}`,
		);
		this.PulumiBackendLoginCommand = bucket.apply(
			(bucket: string) => `pulumi login s3://${bucket}`,
		);
		this.PulumiStackInitCommand = keyId.apply(
			(keyId: string) =>
				`pulumi stack init --secrets-provider='awskms:///${keyId}' ${project}.${stack}`,
		);
	}
}
