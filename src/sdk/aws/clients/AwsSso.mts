import type { AwsClient } from "aws4fetch";
import VError from "verror";
import { z } from "zod";

export const AWS_SSO_BEARER_TOKEN = "x-amz-sso_bearer_token";

export class AwsSso {
	constructor(private client: AwsClient) {}

	async GetRoleCredentials({
		roleName,
		accountId,
		accessToken,
	}: {
		roleName: string;
		accountId: string;
		accessToken: string;
	}): Promise<{
		roleCredentials: {
			accessKeyId: string;
			expiration: Date;
			secretAccessKey: string;
			sessionToken: string;
		};
	}> {
		const endpoint = `https://portal.sso.${this.client.region}.amazonaws.com`;
		const params = [`account_id=${accountId}`, `role_name=${roleName}`];
		const path = `/federation/credentials?${params.join("&")}`;
		const response = await fetch(`${endpoint}${path}`, {
			headers: {
				[AWS_SSO_BEARER_TOKEN]: accessToken,
			},
		});

		if (response.status !== 200) {
			const errorBody = await response.text();
			throw new VError(
				`Failed to get role credentials: ${response.statusText}. Response: ${errorBody}`,
			);
		}

		return z
			.object({
				roleCredentials: z
					.object({
						accessKeyId: z.string(),
						expiration: z.number().transform((n) => new Date(n)),
						secretAccessKey: z.string(),
						sessionToken: z.string(),
					})
					.passthrough(),
			})
			.passthrough()
			.parse(await response.json());
	}
}
