import { AwsClient } from "aws4fetch";
import VError from "verror";
import { z } from "zod";

export class AwsOrganizations {
	constructor(private client: AwsClient) {
		this.client = new AwsClient({
			...client,
			region: "us-east-1",
		});
	}

	async CreateOrganization() {
		const response = await this.client.fetch(
			"https://organizations.us-east-1.amazonaws.com",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AWSOrganizationsV20161128.CreateOrganization",
				},
				body: JSON.stringify({}),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsOrganizationClient: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to create organization: ${response.statusText}`);
		}
		return z
			.object({
				Organization: z.object({
					Arn: z.string(),
					FeatureSet: z.string(),
					MasterAccountArn: z.string(),
					MasterAccountEmail: z.string(),
					MasterAccountId: z.string(),
					AvaliablePolicyTypes: z
						.array(
							z.object({
								Type: z.string(),
								Status: z.string(),
							}),
						)
						.optional(),
				}),
			})
			.parse(await response.json());
	}

	async DescribeOrganization() {
		const response = await this.client.fetch(
			"https://organizations.us-east-1.amazonaws.com/",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AWSOrganizationsV20161128.DescribeOrganization",
				},
				body: JSON.stringify({}),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsOrganizationClient: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			if (response.status === 400) {
				return undefined;
			}
			throw new VError(
				`Failed to describe organization: ${response.statusText}`,
			);
		}
		const { data, error } = z
			.object({
				Organization: z.object({
					Arn: z.string(),
					FeatureSet: z.string(),
					MasterAccountArn: z.string(),
					MasterAccountEmail: z.string(),
					MasterAccountId: z.string(),
					AvaliablePolicyTypes: z
						.array(
							z.object({
								Type: z.string(),
								Status: z.string(),
							}),
						)
						.optional(),
				}),
			})
			.safeParse(await response.json());

		return data;
	}

	async CreateAccount({
		AccountName,
		Email,
		RoleName,
	}: { AccountName: string; Email: string; RoleName?: string }) {
		const response = await this.client.fetch(
			"https://organizations.us-east-1.amazonaws.com",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AWSOrganizationsV20161128.CreateAccount",
				},
				body: JSON.stringify({
					AccountName,
					Email,
					RoleName,
				}),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsOrganizationClient: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to create account: ${response.statusText}`);
		}
		return z
			.object({
				CreateAccountStatus: z.object({
					Id: z.string(),
					AccountName: z.string(),
					State: z.string(),
					RequestedTimestamp: z.number(),
				}),
			})
			.parse(await response.json());
	}

	async DescribeAccountCreationStatus({
		CreateAccountRequestId,
	}: { CreateAccountRequestId: string }) {
		const response = await this.client.fetch(
			"https://organizations.us-east-1.amazonaws.com",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target":
						"AWSOrganizationsV20161128.DescribeCreateAccountStatus",
				},
				body: JSON.stringify({
					CreateAccountRequestId,
				}),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					AwsOrganizationClient: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(
				`Failed to describe account creation status: ${response.statusText}`,
			);
		}
		return z
			.object({
				CreateAccountStatus: z.object({
					Id: z.string(),
					AccountName: z.string(),
					State: z.string(),
					RequestedTimestamp: z.number(),
				}),
			})
			.parse(await response.json());
	}

	async ListAccounts() {
		const response = await this.client.fetch(
			"https://organizations.us-east-1.amazonaws.com",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AWSOrganizationsV20161128.ListAccounts",
				},
				body: JSON.stringify({}),
			},
		);

		// TODO: Paging generator
		if (response.status !== 200) {
			console.dir(
				{
					AwsOrganizationClient: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to list accounts: ${response.statusText}`);
		}
		return z
			.object({
				Accounts: z.array(
					z.object({
						Id: z.string(),
						Arn: z.string(),
						Email: z.string(),
						Name: z.string(),
						Status: z.string(),
						JoinedMethod: z.string(),
						JoinedTimestamp: z.number(),
					}),
				),
			})
			.parse(await response.json());
	}
}
