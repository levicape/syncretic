import type { AwsClient } from "aws4fetch";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
export type RolePolicy = {
	Version: string;
	Statement: {
		Effect: "Allow" | "Deny";
		Principal?:
			| {
					Service: string;
					Federated?: never;
			  }
			| {
					Federated: string[];
					Service?: never;
			  };
		Action: string;
		Condition?: {
			StringLike: {
				[key: string]: string;
			};
		};
		Resource?: string | string[];
	}[];
};
const parser = new XMLParser();
export class AwsPolicy {
	constructor(private client: AwsClient) {}

	async PutRolePolicy({
		PolicyDocument,
		PolicyName,
		RoleName,
	}: { PolicyDocument: RolePolicy; PolicyName: string; RoleName: string }) {
		const response = await this.client.fetch(
			`https://iam.amazonaws.com
			?Action=PutRolePolicy
			&Version=2010-05-08
			&PolicyName=${PolicyName}
			&PolicyDocument=${encodeURIComponent(JSON.stringify(PolicyDocument))}
			&RoleName=${RoleName}`,
			{
				aws: { signQuery: true, region: undefined },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					Policy: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to put role policy: ${response.statusText}`);
		}

		return z
			.object({
				PutRolePolicyResponse: z.object({
					ResponseMetadata: z.object({
						RequestId: z.string(),
					}),
				}),
			})
			.parse(parser.parse(await response.text())).PutRolePolicyResponse;
	}

	async UpdateAssumeRolePolicy({
		PolicyDocument,
		RoleName,
	}: { PolicyDocument: RolePolicy; RoleName: string }) {
		const response = await this.client.fetch(
			`https://iam.amazonaws.com
			?Action=UpdateAssumeRolePolicy
			&Version=2010-05-08
			&PolicyDocument=${encodeURIComponent(JSON.stringify(PolicyDocument))}
			&RoleName=${RoleName}`,
			{
				aws: { signQuery: true, region: undefined },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					Policy: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(
				`Failed to update assume role policy: ${response.statusText}`,
			);
		}

		return z
			.object({
				UpdateAssumeRolePolicyResponse: z.object({
					ResponseMetadata: z.object({
						RequestId: z.string(),
					}),
				}),
			})
			.parse(parser.parse(await response.text()))
			.UpdateAssumeRolePolicyResponse;
	}

	async GetRole({
		RoleName,
	}: {
		RoleName: string;
	}) {
		console.log({
			RoleName,
		});
		const response = await this.client.fetch(
			`https://iam.amazonaws.com
			?Action=GetRole
			&Version=2010-05-08
			&RoleName=${encodeURIComponent(RoleName)}`,
			{
				aws: { signQuery: true, region: undefined },
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					Policy: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to get role: ${response.statusText}`);
		}

		return z
			.object({
				GetRoleResponse: z.object({
					GetRoleResult: z.object({
						Role: z.object({
							Arn: z.string(),
							AssumeRolePolicyDocument: z
								.string()
								.transform(
									(s) => JSON.parse(decodeURIComponent(s)) as RolePolicy,
								),
							CreateDate: z.string(),
							RoleId: z.string(),
							RoleName: z.string(),
						}),
					}),
				}),
			})
			.parse(parser.parse(await response.text())).GetRoleResponse;
	}
}
