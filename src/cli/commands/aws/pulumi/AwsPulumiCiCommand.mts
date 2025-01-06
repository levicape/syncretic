import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import VError from "verror";
import { z } from "zod";
import { AwsClientBuilder } from "../../../../sdk/aws/AwsClientBuilder.mjs";
import { AwsSystemsManager } from "../../../../sdk/aws/clients/AwsSystemsManager.mjs";
import { AwsStateBackendCommandsParameter } from "./AwsPulumiBackendCommand.mjs";

type Flags = {
	region: string;
};

export const AwsPulumiCiCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					const { region } = flags;

					const credentials = await AwsClientBuilder.getAWSCredentials();
					const client = new AwsClient({
						...credentials,
						region,
					});

					const ssm = new AwsSystemsManager(
						client,
						AwsClientBuilder.getAWSCredentials,
					);
					{
						let commandsParameter = await ssm.GetParameter({
							Name: AwsStateBackendCommandsParameter(),
						});

						if (!commandsParameter) {
							throw new VError(
								{
									name: "MISSING_PARAMETER",
								},
								`Could not find parameter ${AwsStateBackendCommandsParameter()} in ${JSON.stringify(
									{
										region,
										credentials: {
											accountId: credentials.accountId,
											accessKeyId: credentials.accessKeyId,
											credentialScope: credentials.credentialScope,
										},
									},
									null,
									2,
								)}.\n This command (ci) does not assume a role and is intented to be executed in the context of a fourtwo configured AWS principal account. \n To create the parameter, please run 'fourtwo aws pulumi backend' first.`,
							);
						}

						let commands = z
							.object({
								pulumi: z
									.object({
										backend: z
											.object({
												url: z.string().optional(),
												key: z.string().optional(),
											})
											.optional(),
									})
									.optional(),
							})
							.parse(JSON.parse(commandsParameter.Parameter.Value));

						process.stdout.write(`\n`);
						process.stdout.write(
							`export PULUMI_BACKEND_URL="${commands.pulumi?.backend?.url}"\n`,
						);
						process.stdout.write(
							`export AWS_PROVIDER_KEY="${commands.pulumi?.backend?.key}"\n`,
						);
					}
				};
			},
			parameters: {
				flags: {
					region: {
						brief: "AWS Region",
						kind: "parsed",
						parse: (value: string) => value,
						optional: false,
					},
				},
			},
			docs: {
				brief:
					'Outputs a shell script to configure a Pulumi backend in an AWS account. To use, run `eval "$(CI=true fourtwo aws pulumi ci)"`.',
			},
		});
};
