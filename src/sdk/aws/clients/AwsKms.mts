import type { AwsClient } from "aws4fetch";
import VError from "verror";
import { z } from "zod";

export type KeyUsage = "ENCRYPT_DECRYPT";
export type KeySpec = "SYMMETRIC_DEFAULT";
export type Origin = "AWS_KMS" | "EXTERNAL" | "AWS_CLOUDHSM";

export type AwsKmsCreateKeyResponse = {
	KeyMetadata: {
		AWSAccountId: string;
		KeyId: string;
		Arn: string;
		CreationDate: string;
		Description: string;
		KeyManager: string;
		KeyState: string;
		KeyUsage: string;
		Origin: string;
	};
};

export class AwsKms {
	constructor(private client: AwsClient) {}

	GetPublicKey = async ({ KeyId }: { KeyId?: string }) => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.GetPublicKey",
				},
				body: JSON.stringify({ KeyId }),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to get public key: ${response.statusText}`,
			);
		}

		return z
			.object({
				KeyId: z.string(),
				PublicKey: z.string().optional(),
			})
			.parse(await response.json());
	};

	ListKeys = async () => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.ListKeys",
				},
				body: JSON.stringify({}),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to list keys: ${response.statusText}`,
			);
		}

		return z
			.object({
				Keys: z.array(
					z.object({
						KeyId: z.string(),
						KeyArn: z.string(),
					}),
				),
			})
			.parse(await response.json());
	};

	ListAliases = async ({
		KeyId,
	}: {
		KeyId?: string;
	}) => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.ListAliases",
				},
				body: JSON.stringify({ KeyId }),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to list aliases: ${response.statusText}`,
			);
		}

		return z
			.object({
				Aliases: z.array(
					z.object({
						AliasName: z.string(),
						AliasArn: z.string(),
						TargetKeyId: z.string().optional(),
					}),
				),
			})
			.parse(await response.json());
	};

	CreateKey = async (request: {
		Description?: string;
		KeyUsage?: KeyUsage;
		KeySpec?: KeySpec;
		Origin?: Origin;
		Policy: string;
	}) => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.CreateKey",
				},
				body: JSON.stringify(request),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
						request,
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to create key: ${response.statusText}`,
			);
		}

		return z
			.object({
				KeyMetadata: z.object({
					AWSAccountId: z.string(),
					KeyId: z.string(),
					Arn: z.string(),
					CreationDate: z.number(),
					Description: z.string().optional(),
					KeyManager: z.string().optional(),
					KeyState: z.string(),
					KeyUsage: z.string(),
					Origin: z.string(),
				}),
			})
			.parse(await response.json());
	};

	CreateAlias = async (request: {
		AliasName: string;
		TargetKeyId: string;
	}) => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.CreateAlias",
				},
				body: JSON.stringify(request),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
						request,
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to create alias: ${response.statusText}`,
			);
		}

		return;
	};

	DeleteAlias = async (request: {
		AliasName: string;
	}) => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.DeleteAlias",
				},
				body: JSON.stringify(request),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
						request,
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to delete alias: ${response.statusText}`,
			);
		}

		return;
	};

	DisableKey = async (request: {
		KeyId: string;
	}) => {
		const response = await this.client.fetch(
			`https://kms.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "TrentService.DisableKey",
				},
				body: JSON.stringify(request),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsKms: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
						request,
					},
				},
				{ depth: null },
			);
			throw new VError(
				{
					name: "AWS_SDK_ERROR",
					info: {
						response,
					},
				},
				`Failed to disable key: ${response.statusText}`,
			);
		}

		return;
	};
}
