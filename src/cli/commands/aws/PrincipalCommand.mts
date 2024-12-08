import { readFile } from "node:fs/promises";
import { cwd } from "node:process";
import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import Enquirer from "enquirer";
import VError from "verror";
import { OIDC, Policy } from "../../../index.mjs";
import { AwsClientBuilder } from "../../../sdk/AwsClientBuilder.mjs";
import { Organizations } from "../../../sdk/aws/Organizations.mjs";
import { Role } from "../../../sdk/aws/Role.mjs";
import { SystemsManager } from "../../../sdk/aws/SystemsManager.mjs";

const enquirer = new Enquirer();
const prompt = enquirer.prompt.bind(enquirer);

type Flags = {
	name?: string;
	email?: string;
	region: string;
};

export const waitForReady = async (
	label: string,
	props: { timeout?: number; isReady: () => Promise<boolean> },
) => {
	const start = Date.now();
	while (Date.now() - start < (props.timeout ?? 20000)) {
		if (await props.isReady()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 4000));
	}
	throw new VError(
		{
			name: "waitForReady",
			message: `Timeout waiting for ${label}`,
		},
		`Timeout waiting for ${label}`,
	);
};

export const principalName = async () => {
	const packageJson = JSON.parse(
		await readFile(`${cwd()}/package.json`, "utf8"),
	);
	return packageJson?.name.replace(/[^a-zA-Z0-9]/g, "-");
};

export const repositoryName = async () => {
	const packageJson = JSON.parse(
		await readFile(`${cwd()}/package.json`, "utf8"),
	);
	let { repository } = packageJson;
	if (typeof repository === "string") {
		if (repository.startsWith("github:")) {
			return repository.split(":")[1];
		}
	}

	console.dir({
		PrincipalCommand: {
			message: "Repository not found in package.json",
			repository,
		},
	});

	return undefined;
};

export const PrincipalOIDCRole = `FourtwoOIDCProviderRole`;
export const PrincipalOIDCParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/OIDCProviderArn`;

export const PrincipalCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					let { name, email, region } = flags;
					const credentials = await AwsClientBuilder.getAWSCredentials();
					const client = new AwsClient({
						...credentials,
						region,
					});
					const organizations = new Organizations(client);
					let roles = new Role(client);
					let root = new SystemsManager(client);

					const org = await organizations.DescribeOrganization();
					if (!org) {
						throw new VError(
							{
								name: "PrincipalCommand",
								message: "Organization not found",
							},
							"Organization not found",
						);
					}

					const accounts = await organizations.ListAccounts();
					console.dir(
						{
							PrincipalCommand: {
								message: "Organization:",
								org,
								accounts: accounts.Accounts.map((account) => ({
									Id: account.Id,
									Name: account.Name,
									Email: account.Email,
									Status: account.Status,
								})).length,
							},
						},
						{ depth: null },
					);
					name = name ?? (await principalName());
					if (!name) {
						throw new VError(
							{
								name: "PrincipalCommand",
								message: "Could not infer name from package.json",
							},
							"Name is required",
						);
					}

					let principal:
						| { Id: string; Name: string; Email: string }
						| undefined;
					if (
						accounts.Accounts.find((account) => account.Name === name) !==
						undefined
					) {
						console.dir({
							PrincipalCommand: {
								message: "Account already exists",
								name,
							},
						});

						principal = accounts.Accounts.find(
							(account) => account.Name === name,
						);
					} else {
						email =
							email ??
							(
								(await prompt({
									type: "input",
									name: "email",
									message:
										"Email address must be specified when creating a new account. Please enter a valid email address",
								})) as { email: string }
							).email;
						if (!email.match(/^.+@.+\..+$/) || email.trim().length === 0) {
							throw new VError(
								{
									name: "PrincipalCommand",
									message: "Invalid email address",
								},
								"Invalid email address",
							);
						}
						const response = (await prompt({
							type: "confirm",
							name: "proceed",
							message: `Create account principal ${name}?`,
						})) as { proceed?: boolean };

						if (!response?.proceed) {
							return;
						}

						let { CreateAccountStatus } = await organizations.CreateAccount({
							AccountName: name,
							Email: email,
						});
						console.dir({
							PrincipalCommand: {
								message: "Account created",
								CreateAccountStatus,
							},
						});

						await waitForReady("account", {
							isReady: async () => {
								console.dir({
									PrincipalCommand: {
										message: "Checking account status",
									},
								});
								const account =
									await organizations.DescribeAccountCreationStatus({
										CreateAccountRequestId: CreateAccountStatus.Id,
									});
								return account?.CreateAccountStatus.State === "ACTIVE";
							},
						});

						({ CreateAccountStatus } =
							await organizations.DescribeAccountCreationStatus({
								CreateAccountRequestId: CreateAccountStatus.Id,
							}));

						principal = {
							Id: CreateAccountStatus.Id,
							Name: name,
							Email: email,
						};
					}

					const serviceRole = "OrganizationAccountAccessRole";
					const { AssumedRoleUser, Credentials } = (
						await roles.AssumeRole({
							RoleArn: `arn:aws:iam::${principal?.Id}:role/${serviceRole}`,
							RoleSessionName: "FourtwoPrincipalCommand",
						})
					).AssumeRoleResult;

					console.dir(
						{
							PrincipalCommand: {
								message: "Assumed role",
								AssumedRoleUser,
							},
						},
						{ depth: null },
					);

					{
						const assumed = new AwsClient({
							accessKeyId: Credentials.AccessKeyId,
							secretAccessKey: Credentials.SecretAccessKey,
							sessionToken: Credentials.SessionToken,
							region,
						});

						const oidc = new OIDC(assumed);
						const systems = new SystemsManager(assumed);
						const policies = new Policy(assumed);
						roles = new Role(assumed);

						let repo = await repositoryName();

						if (!repo) {
							console.dir({
								PrincipalCommand: {
									message: "Skipping OIDC, repository not found",
								},
							});
						} else {
							let provider: Awaited<
								ReturnType<typeof oidc.CreateOpenIDConnectProvider>
							>["CreateOpenIDConnectProviderResult"];
							provider = (
								await oidc.CreateOpenIDConnectProvider(
									{
										Url: "https://token.actions.githubusercontent.com",
										ClientIdList: ["sts.amazonaws.com"],
										ThumbprintList: [
											"6938fd4d98bab03faadb97b34396831e3780aea1",
										],
										Tags: [
											{ Key: "Name", Value: `${serviceRole}-OIDC-Provider` },
										],
									},
									{ iam: principal?.Id ?? "<account-arn>" },
								)
							)?.CreateOpenIDConnectProviderResult;

							console.dir(
								{
									PrincipalCommand: {
										message: "Created OIDC Provider",
										provider,
									},
								},
								{ depth: null },
							);

							const oidcRole = PrincipalOIDCRole;
							let service: Awaited<ReturnType<typeof roles.CreateRole>>;
							service = await roles.CreateRole(
								{
									RoleName: oidcRole,
									AssumeRolePolicyDocument: JSON.stringify({
										Version: "2012-10-17",
										Statement: [
											{
												Effect: "Allow",
												Principal: {
													Federated: provider?.OpenIDConnectProviderArn,
												},
												Action: "sts:AssumeRoleWithWebIdentity",
												Condition: {
													StringLike: {
														"token.actions.githubusercontent.com:sub": `repo:${repo}:*`,
													},
												},
											},
										],
									}),
								},
								{ iam: principal?.Id ?? "<account-arn>" },
							);

							console.dir(
								{
									PrincipalCommand: {
										message:
											service.$kind === "new"
												? "Created Role"
												: "Role already exists",
										service,
									},
								},
								{ depth: null },
							);

							let policy: Awaited<ReturnType<typeof policies.PutRolePolicy>>;
							policy = await policies.PutRolePolicy({
								RoleName: service.CreateRoleResult.Role.RoleName,
								PolicyName: "FourtwoOIDCRolePolicy",
								PolicyDocument: {
									Version: "2012-10-17",
									Statement: [
										{
											Effect: "Allow",
											Action: "*",
											Resource: "*",
										},
									],
								},
							});

							console.dir(
								{
									PrincipalCommand: {
										message: "Updated role policy FourtwoOIDCRolePolicy",
										policy,
									},
								},
								{ depth: null },
							);

							let parameter = PrincipalOIDCParameter();
							let scopedParameter = PrincipalOIDCParameter(
								await principalName(),
							);

							let existing: Awaited<ReturnType<typeof systems.GetParameter>>;
							existing = await systems.GetParameter({
								Name: parameter,
							});

							let updateParameter =
								existing?.Parameter?.Value !==
								service.CreateRoleResult.Role.Arn;

							if (updateParameter) {
								let param: Awaited<ReturnType<typeof systems.PutParameter>>;
								param = await systems.PutParameter({
									Name: parameter,
									Value: service.CreateRoleResult.Role.Arn,
									Type: "String",
									Overwrite: true,
								});

								await root.PutParameter({
									Name: scopedParameter,
									Value: service.CreateRoleResult.Role.Arn,
									Type: "String",
									Overwrite: true,
								});

								console.dir(
									{
										PrincipalCommand: {
											message: "Updated role parameter",
											param,
										},
									},
									{ depth: null },
								);
							} else {
								console.dir(
									{
										PrincipalCommand: {
											message: "Role parameter already up-to-date",
											existing,
										},
									},
									{ depth: null },
								);
							}
						}
					}
				};
			},
			parameters: {
				flags: {
					name: {
						brief:
							"Name of the principal. Defaults to URL-safe root package.json name",
						kind: "parsed",
						parse: (value: string) => {
							if (value.trim().length === 0) {
								throw new VError(
									{
										name: "PrincipalCommand",
										message: "Name should be a non-empty string",
									},
									"Name is required",
								);
							}
							return value;
						},
						optional: true,
					},
					email: {
						brief: "Email address for the principal",
						kind: "parsed",
						parse: (value: string) => {
							if (value.trim().length === 0) {
								throw new VError(
									{
										name: "PrincipalCommand",
										message: "Email address is required",
									},
									"Email address is required",
								);
							}

							if (!value.match(/^.+@.+\..+$/)) {
								throw new VError(
									{
										name: "PrincipalCommand",
										message: "Invalid email address",
									},
									"Invalid email address",
								);
							}
							return value;
						},
						optional: true,
					},
					region: {
						brief: "AWS Region",
						kind: "parsed",
						parse: (value: string) => value,
						optional: false,
					},
				},
			},
			docs: {
				brief: "Create an AWS organization for the current account",
			},
		});
};
