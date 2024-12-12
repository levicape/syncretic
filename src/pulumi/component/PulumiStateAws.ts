import { getCallerIdentity } from "@pulumi/aws/index.js";
import { Key } from "@pulumi/aws/kms";
import {
	BucketPublicAccessBlock,
	BucketServerSideEncryptionConfigurationV2,
	BucketV2,
	BucketVersioningV2,
} from "@pulumi/aws/s3/index.js";
import {
	ComponentResource,
	type ComponentResourceOptions,
	getProject,
	getStack,
} from "@pulumi/pulumi/index.js";
import type { Context } from "../../context/Context.js";
import { AwsState } from "../component/aws/AwsState.js";

export interface PulumiStateAwsArgs {
	awsAccountId: string;
}
export class PulumiStateAws extends ComponentResource {
	public readonly bucket: BucketV2;

	public readonly PULUMI_BACKEND_URL;
	public readonly PULUMI_SECRETS_PROVIDER;
	public readonly PulumiBackendLoginCommand;
	public readonly PulumiStackInitCommand;

	static bootstrap = async ({
		bootstrap,
	}: Context): Promise<PulumiStateAws | undefined> => {
		if (bootstrap === true) {
			const { accountId: awsAccountId } = await getCallerIdentity();
			return new PulumiStateAws("PulumiObjectStoreStateAws", {
				awsAccountId,
			});
		}
		return undefined;
	};

	constructor(
		name: string,
		{ awsAccountId }: PulumiStateAwsArgs,
		opts?: ComponentResourceOptions,
	) {
		super(AwsState.URN, name, {}, opts);

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

		this.PULUMI_BACKEND_URL = bucket.apply((bucket) => `s3://${bucket}`);
		this.PULUMI_SECRETS_PROVIDER = keyId.apply((keyId) => `awskms:///${keyId}`);
		this.PulumiBackendLoginCommand = bucket.apply(
			(bucket) => `pulumi login s3://${bucket}`,
		);
		this.PulumiStackInitCommand = keyId.apply(
			(keyId) =>
				`pulumi stack init --secrets-provider='awskms:///${keyId}' ${project}.${stack}`,
		);
	}
}
