import type { AwsClient } from "aws4fetch";
import { XMLParser } from "fast-xml-parser";
import VError from "verror";
import { z } from "zod";

export class AwsOIDC {
	parser: XMLParser = new XMLParser();

	constructor(private client: AwsClient) {}

	async CreateOpenIDConnectProvider(
		{
			Url,
			ClientIdList,
			ThumbprintList,
			Tags,
		}: {
			Url: string;
			ClientIdList: string[];
			ThumbprintList: string[];
			Tags?: { Key: string; Value: string }[];
		},
		{ iam }: { iam: string },
	) {
		const response = await this.client.fetch(
			`https://iam.amazonaws.com
			?Action=CreateOpenIDConnectProvider
			&Url=${Url}
			${ClientIdList.map((ClientId, index) => `&ClientIDList.list.${index + 1}=${ClientId}`).join("")}
			${ThumbprintList.map((Thumbprint, index) => `&ThumbprintList.list.${index + 1}=${Thumbprint}`).join("")}
			${Tags?.map(({ Key, Value }, index) => `&Tags.member.${index + 1}.Key=${Key}&Tags.member.${index + 1}.Value=${Value}`) ?? ""}
			&Version=2010-05-08`,
			{ aws: { signQuery: true, region: undefined } },
		);

		if (response.status !== 200) {
			if (response.status === 409 && response.statusText === "Conflict") {
				return {
					CreateOpenIDConnectProviderResult: {
						OpenIDConnectProviderArn: `arn:aws:iam::${iam}:oidc-provider/${Url}`,
					},
				};
			}
			console.dir(
				{
					OIDC: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
					parms: {
						Url,
						ClientIdList,
						ThumbprintList,
						Tags,
					},
				},
				{ depth: null },
			);
			throw new VError(
				`Failed to create OIDC provider: ${response.statusText}`,
			);
		}

		return z
			.object({
				CreateOpenIDConnectProviderResponse: z.object({
					CreateOpenIDConnectProviderResult: z.object({
						OpenIDConnectProviderArn: z.string(),
					}),
				}),
			})
			.parse(this.parser.parse(await response.text()))
			.CreateOpenIDConnectProviderResponse;
	}

	async CreateToken({
		clientId,
		clientSecret,
		grantType,
		refreshToken,
	}: {
		clientId: string;
		clientSecret: string;
		grantType: "refresh_token";
		refreshToken: string;
	}) {
		const response = await this.client.fetch(
			`https://oidc.aws.amazon.com/oidc/token?grant_type=${grantType}&refresh_token=${refreshToken}`,
			{
				method: "POST",
				headers: {
					Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					OIDC: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
					parms: {
						clientId,
						clientSecret,
						grantType,
						refreshToken,
					},
				},
				{ depth: null },
			);
			throw new VError(`Failed to create OIDC token: ${response.statusText}`);
		}

		return z
			.object({
				expires_in: z.number(),
				token_type: z.string(),
				refresh_token: z.string(),
				scope: z.string(),
				id_token: z.string(),
				access_token: z.string(),
			})
			.parse(this.parser.parse(await response.text()));
	}
}
