import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import { AwsClientBuilder } from "../../../sdk/AwsClientBuilder.mjs";
import { Organizations } from "../../../sdk/aws/Organizations.mjs";

type Flags = {};

export const OrganizationCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					const credentials = await AwsClientBuilder.getAWSCredentials();
					const organizations = new Organizations(
						new AwsClient({
							...credentials,
						}),
					);

					let org = await organizations.DescribeOrganization();
					if (org) {
						console.dir(
							{
								OrganizationCommand: {
									message: "Organization exists:",
									org,
								},
							},
							{ depth: null },
						);

						return;
					}

					console.dir(
						{
							OrganizationCommand: {
								message: "Creating organization",
							},
						},
						{ depth: null },
					);

					org = await organizations.CreateOrganization();
					console.dir(
						{
							OrganizationCommand: {
								message: "Organization created:",
								org,
							},
						},
						{ depth: null },
					);
				};
			},
			parameters: {},
			docs: {
				brief: "Create an AWS organization for the current account",
			},
		});
};
