import type { AwsClient } from "aws4fetch";
import { z } from "zod";
export class AwsElasticContainerRegistry {
	constructor(private client: AwsClient) {}

	async CreateRepository({
		repositoryName,
		tags,
	}: { repositoryName: string; tags?: Record<string, string> }) {
		const response = await this.client.fetch("https://ecr.amazonaws.com", {
			method: "POST",
			headers: {
				"X-Amz-Target": "AmazonEC2ContainerRegistry_V20150921.CreateRepository",
			},
			body: JSON.stringify({
				repositoryName,
				tags,
			}),
		});

		if (response.status !== 200) {
			console.dir(
				{
					ElasticContainerRegistry: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to create repository: ${response.statusText}`);
		}
		return z
			.object({
				repository: z.object({
					repositoryArn: z.string(),
					registryId: z.string(),
					repositoryName: z.string(),
					createdAt: z.string(),
					imageTagMutability: z.string(),
					imageScanningConfiguration: z.object({
						scanOnPush: z.boolean(),
					}),
					encryptionConfiguration: z.object({
						encryptionType: z.string(),
						kmsKey: z.string(),
					}),
				}),
			})
			.parse(await response.json());
	}
}
