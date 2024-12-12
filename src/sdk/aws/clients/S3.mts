import type { AwsClient } from "aws4fetch";
import { z } from "zod";

export class S3 {
	constructor(private client: AwsClient) {}

	async CreateBucket({ BucketName }: { BucketName: string }) {
		if (BucketName.length < 3 || BucketName.length > 63) {
			throw new Error("Bucket name must be between 3 and 63 characters");
		}

		if (BucketName.match(/[^a-z0-9.-]/)) {
			throw new Error("Bucket name must be alphanumeric");
		}

		if (BucketName.length > 63 - 7) {
			throw new Error("Bucket name must be less than 57 characters");
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
}
