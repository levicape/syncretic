import type { AwsClient } from "aws4fetch";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

export type AssumeRolePolicy = {
	Version: string;
	Statement: {
		Effect: "Allow" | "Deny";
		Principal:
			| {
					Service: string;
			  }
			| {
					Federated: string[];
			  };
		Action: string;
		Condition: {
			StringLike: {
				[key: string]: string;
			};
		};
	}[];
};

const parser = new XMLParser();

export class AwsRole {
	constructor(private client: AwsClient) {}

	async CreateRole(
		{
			RoleName,
			AssumeRolePolicyDocument,
			Description,
			MaxSessionDuration,
			Path,
			PermissionsBoundary,
			Tags,
		}: {
			RoleName: string;
			AssumeRolePolicyDocument: string;
			Description?: string;
			MaxSessionDuration?: number;
			Path?: string;
			PermissionsBoundary?: string;
			Tags?: Record<string, string>;
		},
		{ iam }: { iam: string },
	) {
		const response = await this.client.fetch(
			`https://iam.amazonaws.com
			?Action=CreateRole
			&RoleName=${encodeURIComponent(RoleName)}
			&AssumeRolePolicyDocument=${encodeURIComponent(AssumeRolePolicyDocument)}
			${Description ? `&Description=${encodeURIComponent(Description)}` : ""}
			${MaxSessionDuration ? `&MaxSessionDuration=${MaxSessionDuration}` : ""}
			${Path ? `&Path=${encodeURIComponent(Path)}` : ""}
			${PermissionsBoundary ? `&PermissionsBoundary=${encodeURIComponent(PermissionsBoundary)}` : ""}
			${
				Tags
					? Object.entries(Tags)
							.map(
								([key, value]) =>
									`&Tags.${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
							)
							.join("")
					: ""
			}
			&Version=2010-05-08`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				aws: { signQuery: true, region: undefined },
			},
		);

		if (response.status !== 200) {
			const text = await response.text();
			if (response.status === 409 && response.statusText === "Conflict") {
				if (text.includes("EntityAlreadyExists")) {
					return {
						CreateRoleResponse: {
							$kind: "existing" as const,
							CreateRoleResult: {
								Role: {
									Arn: `arn:aws:iam::${iam}:role/${RoleName}`,
									CreateDate: new Date().toISOString(),
									MaxSessionDuration,
									Path,
									RoleName,
									AssumeRolePolicyDocument,
									Description,
									PermissionsBoundary,
									Tags,
								},
							},
						},
					}.CreateRoleResponse;
				}
			}

			console.dir(
				{
					Role: {
						status: response.status,
						statusText: response.statusText,
						body: text,
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to create role: ${response.statusText}`);
		}

		const xml = await response.text();
		return z
			.object({
				CreateRoleResponse: z.object({
					$kind: z.literal("new").default("new").catch("new"),
					CreateRoleResult: z.object({
						Role: z.object({
							Path: z.string(),
							RoleName: z.string(),
							RoleId: z.string(),
							Arn: z.string(),
							CreateDate: z.string(),
							AssumeRolePolicyDocument: z.string(),
							Description: z.string().optional(),
							MaxSessionDuration: z.number().optional(),
							PermissionsBoundary: z.string().optional(),
							Tags: z.record(z.string()).optional(),
						}),
					}),
				}),
			})
			.parse(parser.parse(xml)).CreateRoleResponse;
	}

	async DeleteRole({ RoleName }: { RoleName: string }) {
		const response = await this.client.fetch("https://iam.amazonaws.com", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-amz-json-1.1",
				"X-Amz-Target": "AWSSecurityTokenServiceV20110615.DeleteRole",
			},
			body: JSON.stringify({
				RoleName,
			}),
			aws: { region: undefined },
		});

		if (response.status !== 200) {
			console.dir(
				{
					Role: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to delete role: ${response.statusText}`);
		}

		return await response.json();
	}

	async AssumeRole({
		RoleArn,
		RoleSessionName,
	}: { RoleArn: string; RoleSessionName: string }) {
		const response = await this.client.fetch(
			`https://sts.amazonaws.com
			?Version=2011-06-15
			&Action=AssumeRole
			&RoleArn=${RoleArn}
			&RoleSessionName=${RoleSessionName}`,
			{ aws: { signQuery: true, region: undefined } },
		);

		if (response.status !== 200) {
			console.dir(
				{
					Role: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to assume role: ${response.statusText}`);
		}

		return z
			.object({
				AssumeRoleResponse: z.object({
					AssumeRoleResult: z.object({
						Credentials: z.object({
							AccessKeyId: z.string(),
							SecretAccessKey: z.string(),
							SessionToken: z.string(),
							Expiration: z.string(),
						}),
						AssumedRoleUser: z.object({
							AssumedRoleId: z.string(),
							Arn: z.string(),
						}),
					}),
				}),
			})
			.parse(parser.parse(await response.text())).AssumeRoleResponse;
	}
}
