import { AwsClient } from "aws4fetch";
import VError from "verror";
import { z } from "zod";

export class AwsS3 {
	constructor(private client: AwsClient) {
		this.client = new AwsClient({
			...client,
			region: "us-east-1",
		});
	}

	async CreateBucket({ BucketName }: { BucketName: string }) {
		if (BucketName.length < 3 || BucketName.length > 63) {
			throw new VError(
				{
					name: "INVALID_BUCKET_NAME",
					info: {
						BucketName,
					},
				},
				"Bucket name (%s) must be between 3 and 63 characters",
				BucketName,
			);
		}

		if (BucketName.match(/[^a-z0-9.-]/)) {
			throw new VError(
				{
					name: "INVALID_BUCKET_NAME",
					info: {
						BucketName,
					},
				},
				"Bucket name (%s) must be alphanumeric",
				BucketName,
			);
		}

		if (BucketName.length > 63 - 7) {
			throw new VError(
				{
					name: "INVALID_BUCKET_NAME",
					info: {
						BucketName,
					},
				},
				"Bucket name (%s) must be less than 57 characters",
				BucketName,
			);
		}

		let uniqueName = `${BucketName}-${Math.random().toString(36).substring(7)}`;

		if (uniqueName.length > 63) {
			uniqueName = uniqueName.slice(0, 63);
		}

		const response = await this.client.fetch(
			`https://${uniqueName}.s3.us-east-1.amazonaws.com/`,
			{
				method: "PUT",
				headers: {
					"x-amz-acl": "private",
					"x-amz-object-ownership": "BucketOwnerPreferred",
				},
				aws: { region: "us-east-1" },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					S3: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to create bucket: ${response.statusText}`);
		}

		return {
			Bucket: {
				Name: BucketName,
				Location: response.headers.get("Location"),
			},
		};
	}

	// PutBucketEncryption
	async PutBucketEncryption({
		BucketName,
		EncryptionConfiguration,
		ExpectedBucketOwner,
	}: {
		BucketName: string;
		EncryptionConfiguration: {
			EncryptionType: "AES256" | "aws:kms";
			KmsKeyId?: string;
		};
		ExpectedBucketOwner: string;
	}) {
		const body = `
		<ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
					<Rule>
						<ApplyServerSideEncryptionByDefault>
							<KMSMasterKeyID>${EncryptionConfiguration.KmsKeyId}</KMSMasterKeyID>
							<SSEAlgorithm>${EncryptionConfiguration.EncryptionType}</SSEAlgorithm>
						</ApplyServerSideEncryptionByDefault>
						<BucketKeyEnabled>true</BucketKeyEnabled>
					</Rule>
				</ServerSideEncryptionConfiguration>`.trim();

		let bucketLocation = BucketName;
		if (BucketName.startsWith("/")) {
			bucketLocation = BucketName.substring(1);
		}

		const response = await this.client.fetch(
			`https://${bucketLocation}.s3.us-east-1.amazonaws.com/?encryption`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/xml",
					"x-amz-expected-bucket-owner": ExpectedBucketOwner,
				},
				body,
				aws: { region: "us-east-1", signQuery: true, allHeaders: true },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					S3: {
						status: response.status,
						statusText: response.statusText,
						request: body.split("\n").map((line) => line.trim()),
						body: await response.text(),
						bucketLocation,
						ExpectedBucketOwner,
					},
				},
				{ depth: null },
			);
			throw new Error(
				`Failed to put bucket encryption: ${response.statusText}`,
			);
		}

		return;
	}

	async PutPublicAccessBlock({
		BucketName,
		PublicAccessBlockConfiguration,
		ExpectedBucketOwner,
	}: {
		BucketName: string;
		PublicAccessBlockConfiguration: {
			BlockPublicAcls: boolean;
			IgnorePublicAcls: boolean;
			BlockPublicPolicy: boolean;
			RestrictPublicBuckets: boolean;
		};
		ExpectedBucketOwner: string;
	}) {
		let bucketLocation = BucketName;
		if (BucketName.startsWith("/")) {
			bucketLocation = BucketName.substring(1);
		}

		const response = await this.client.fetch(
			`https://${bucketLocation}.s3.us-east-1.amazonaws.com/?publicAccessBlock`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/xml",
					"x-amz-expected-bucket-owner": ExpectedBucketOwner,
				},
				body: `
				<PublicAccessBlockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
					<BlockPublicAcls>${PublicAccessBlockConfiguration.BlockPublicAcls}</BlockPublicAcls>
					<IgnorePublicAcls>${PublicAccessBlockConfiguration.IgnorePublicAcls}</IgnorePublicAcls>
					<BlockPublicPolicy>${PublicAccessBlockConfiguration.BlockPublicPolicy}</BlockPublicPolicy>
					<RestrictPublicBuckets>${PublicAccessBlockConfiguration.RestrictPublicBuckets}</RestrictPublicBuckets>
				</PublicAccessBlockConfiguration>`.trim(),

				aws: { region: "us-east-1", signQuery: true, allHeaders: true },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					S3: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(
				`Failed to put public access block: ${response.statusText}`,
			);
		}

		return;
	}

	async PutBucketVersioning({
		BucketName,
		VersioningConfiguration,
		ExpectedBucketOwner,
	}: {
		BucketName: string;
		VersioningConfiguration: {
			Status: "Enabled" | "Suspended";
		};
		ExpectedBucketOwner: string;
	}) {
		let bucketLocation = BucketName;
		if (BucketName.startsWith("/")) {
			bucketLocation = BucketName.substring(1);
		}

		const response = await this.client.fetch(
			`https://${bucketLocation}.s3.us-east-1.amazonaws.com/?versioning`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/xml",
					"x-amz-expected-bucket-owner": ExpectedBucketOwner,
				},
				body: `
				<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
					<Status>${VersioningConfiguration.Status}</Status>
				</VersioningConfiguration>`.trim(),
				aws: { region: "us-east-1", signQuery: true, allHeaders: true },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					S3: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(
				`Failed to put bucket versioning: ${response.statusText}`,
			);
		}

		return;
	}
}
