import { buildCommand } from "@stricli/core";
import VError from "verror";
import { AwsCodebuild } from "../../../../../sdk/aws/clients/AwsCodebuild.mjs";
import { AwsPrincipalNameFromPackageJson } from "../../../../context/PackageJson.mjs";
import { RunAwsPrincipalOaaAssumeSequence } from "../../../../sequences/aws/AwsPrincipalOaaAssumeSequence.mjs";
type Flags = {
	region: string;
	token: string;
	credentialsArn?: string;
	oauth?: boolean;
	prefix?: string;
	replace: boolean;
	role: string;
};

export const AwsCodebuildGithubAuthCredentialsParameter = (
	principal?: string,
) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/codebuild/github/auth/SourceCredentialsArn`;

export const AwsCodebuildGithubAuthCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					{
						const { region, role, oauth, prefix, replace } = flags;
						const principal = await AwsPrincipalNameFromPackageJson({ prefix });
						let { credentialsArn, token } = flags;
						let { assumed, parameters } =
							await RunAwsPrincipalOaaAssumeSequence({
								principal,
								region,
								role,
							});
						const codebuild = new AwsCodebuild(assumed);
						let credentials: { arn: string } | undefined;

						let credentialsParameter = (
							await parameters.next({
								template: AwsCodebuildGithubAuthCredentialsParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (credentialsParameter?.$$kind !== "loaded") {
							throw new VError(
								{
									name: "credentials",
									message: "Failed to load credentials parameter",
								},
								`Failed to load credentials parameter. Received ${JSON.stringify(
									credentialsParameter,
								)}`,
							);
						}

						let existing = credentialsParameter.parameter.root.value;
						if (credentialsArn === undefined) {
							if (existing && token && !replace) {
								throw new VError(
									{
										name: "credentials",
										message: "Credentials already exist",
									},
									"Credentials already exist. Please use --replace to update",
								);
							}

							if (existing && !replace) {
								credentialsArn = existing?.Parameter.Value;

								if (!credentialsArn) {
									console.dir(
										{
											CodebuildGithubAuthCommand: {
												message: "No previous credentials found",
											},
										},
										{ depth: null },
									);
								}

								console.dir(
									{
										CodebuildGithubAuthCommand: {
											message: "Using existing credentials",
											credentialsArn,
										},
									},
									{ depth: null },
								);
							}
						} else {
							if (existing && !replace) {
								throw new VError(
									{
										name: "credentials",
										message: "Credentials already exist",
									},
									"Credentials already exist. Please use --replace to update",
								);
							}

							console.dir(
								{
									CodebuildGithubAuthCommand: {
										message: "Importing credentials",
										credentialsArn,
									},
								},
								{ depth: null },
							);
						}
						let onlyOne = [credentialsArn, token, oauth].filter((v) => v);
						if (!(onlyOne.length === 1)) {
							throw new VError(
								{
									name: "credentials",
									message:
										"Only one of --credential-arn, --token, or --oauth can be provided",
								},
								"Only one of --credential-arn, --token, or --oauth can be provided",
							);
						}

						switch (true as boolean | undefined) {
							case credentialsArn:
								credentials = { arn: credentialsArn! };
								break;
							case token?.startsWith("ghp_"):
								credentials = await codebuild.ImportSourceCredentials({
									serverType: "GITHUB",
									authType: "PERSONAL_ACCESS_TOKEN",
									token,
								});
								break;
							case oauth:
								throw new VError("Not implemented");
							default:
								throw new VError("Invalid credentials");
						}

						await credentialsParameter?.update(credentials.arn);
						console.dir(
							{
								CodebuildGithubAuthCommand: {
									message: "Updated credentials",
									credentialsArn: credentials.arn,
								},
							},
							{ depth: null },
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
					token: {
						brief: "Github token to associate with the AWS Principal",
						kind: "parsed",
						parse: (value: string) => value,
						optional: false,
					},
					role: {
						brief: "Role to assume. Defaults to OrganizationAccountAccessRole",
						kind: "parsed",
						parse: (value: string) => value,
						default: "OrganizationAccountAccessRole",
					},
					prefix: {
						brief:
							"Prefix for the principal. Defaults to 'dev'. Mutually exclusive with name",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
					replace: {
						brief: "Replace the existing credentials",
						kind: "boolean",
						default: false,
					},
					credentialsArn: {
						brief: "ARN of the existing credentials",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
				},
			},
			docs: {
				brief:
					"Set up an AWS Codebuild project to run Github Actions workflows.",
			},
		});
};
