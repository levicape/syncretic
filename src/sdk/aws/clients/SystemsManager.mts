import type { AwsClient } from "aws4fetch";
import { z } from "zod";

export class SystemsManager {
	constructor(private client: AwsClient) {}

	async GetParameter({ Name }: { Name: string }) {
		const response = await this.client.fetch(
			`https://ssm.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Accept-Encoding": "identity",
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AmazonSSM.GetParameter",
				},
				body: JSON.stringify({
					Name,
				}),
			},
		);

		if (response.status !== 200) {
			let text = await response.text();
			if (response.status === 400 && text.includes("ParameterNotFound")) {
				return undefined;
			}
			console.dir(
				{
					ParameterStore: {
						status: response.status,
						statusText: response.statusText,
						body: text,
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to get parameter: ${response.statusText}`);
		}

		return z
			.object({
				Parameter: z.object({
					Name: z.string(),
					Type: z.string(),
					Value: z.string(),
					Version: z.number(),
					LastModifiedDate: z.number(),
					ARN: z.string(),
				}),
			})
			.parse(await response.json());
	}

	async PutParameter({
		Name,
		Value,
		Type,
		Overwrite,
	}: {
		Name: string;
		Value: string;
		Type: "String" | "StringList" | "SecureString";
		Overwrite?: boolean;
	}) {
		const response = await this.client.fetch(
			`https://ssm.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AmazonSSM.PutParameter",
				},
				body: JSON.stringify({
					Name,
					Value,
					Type,
					Overwrite,
				}),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					ParameterStore: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to put parameter: ${response.statusText}`);
		}

		return z
			.object({
				Version: z.number(),
			})
			.parse(await response.json());
	}
}
