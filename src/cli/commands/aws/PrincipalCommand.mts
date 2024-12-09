import { readFile } from "node:fs/promises";
import { cwd } from "node:process";
import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import Enquirer from "enquirer";
import VError from "verror";
import { AwsClientBuilder } from "../../../sdk/AwsClientBuilder.mjs";
import { OIDC } from "../../../sdk/aws/OIDC.mjs";
import { Organizations } from "../../../sdk/aws/Organizations.mjs";
import { Policy } from "../../../sdk/aws/Policy.mjs";
import { Role } from "../../../sdk/aws/Role.mjs";
import { SystemsManager } from "../../../sdk/aws/SystemsManager.mjs";

const enquirer = new Enquirer();
const prompt = enquirer.prompt.bind(enquirer);

type Flags = {
	name?: string;
	email?: string;
	prefix?: string;
	region: string;
};

const IAM_CONSISTENCY_DELAY = 5000;
const OIDC_CONSISTENCY_DELAY = 3000;

export const waitForReady = async (
	label: string,
	props: { timeout?: number; isReady: () => Promise<boolean> },
) => {
	const start = Date.now();
	console.dir({
		waitForReady: {
			message: `Waiting for ${label}`,
			timeout: `${props.timeout ?? 60000}ms`,
		},
	});

	while (Date.now() - start < (props.timeout ?? 60000)) {
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

export const principalName = async (prefix?: string) => {
	const packageJson = JSON.parse(
		await readFile(`${cwd()}/package.json`, "utf8"),
	);
	return (prefix ?? "dev") + packageJson?.name.replace(/[^a-zA-Z0-9]/g, "-");
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
	`/fourtwo/${principal ? `${principal}` : "_principal"}/principal/OIDCProviderArn`;
export const PrincipalOAARole = "OrganizationAccountAccessRole";
export const PrincipalOAAParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/principal/OrganizationAccountAccessRoleArn`;

export const PrincipalCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					let { name, email, region, prefix } = flags;

					if (name && prefix) {
						throw new VError(
							{
								name: "PrincipalCommand",
								message: "Name and prefix are mutually exclusive",
							},
							"Name and prefix are mutually exclusive",
						);
					}
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
					name = name ?? (await principalName(prefix));
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
							RoleName: PrincipalOAARole,
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

					await new Promise((resolve) =>
						setTimeout(resolve, IAM_CONSISTENCY_DELAY),
					);

					const serviceRole = PrincipalOAARole;
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

							await new Promise((resolve) =>
								setTimeout(resolve, OIDC_CONSISTENCY_DELAY),
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
							await new Promise((resolve) =>
								setTimeout(resolve, IAM_CONSISTENCY_DELAY),
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
							await (async () => {
								let parameter = PrincipalOIDCParameter();
								let scopedParameter = PrincipalOIDCParameter(
									await principalName(prefix),
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

									const owner = await root.PutParameter({
										Name: scopedParameter,
										Value: service.CreateRoleResult.Role.Arn,
										Type: "String",
										Overwrite: true,
									});

									console.dir(
										{
											PrincipalCommand: {
												message: "Updated role OIDC parameter",
												owner,
												param,
											},
										},
										{ depth: null },
									);
								} else {
									console.dir(
										{
											PrincipalCommand: {
												message: "Role OIDC parameter already up-to-date",
												existing,
											},
										},
										{ depth: null },
									);
								}
							})();

							await (async () => {
								let parameter = PrincipalOAAParameter();
								let scopedParameter = PrincipalOAAParameter(
									await principalName(prefix),
								);

								let existing: Awaited<ReturnType<typeof systems.GetParameter>>;
								existing = await systems.GetParameter({
									Name: parameter,
								});

								let arn = `arn:aws:iam::${principal?.Id}:role/${serviceRole}`;
								let updateParameter = existing?.Parameter?.Value !== arn;

								if (updateParameter) {
									let param: Awaited<ReturnType<typeof systems.PutParameter>>;
									param = await systems.PutParameter({
										Name: parameter,
										Value: arn,
										Type: "String",
										Overwrite: true,
									});

									const owner = await root.PutParameter({
										Name: scopedParameter,
										Value: arn,
										Type: "String",
										Overwrite: true,
									});

									console.dir(
										{
											PrincipalCommand: {
												message: "Updated Organization Access role parameters",
												owner,
												param,
											},
										},
										{ depth: null },
									);
								} else {
									console.dir(
										{
											PrincipalCommand: {
												message:
													"Role Organization Access parameter already up-to-date",
												existing,
											},
										},
										{ depth: null },
									);
								}
							})();
						}
					}
				};
			},
			parameters: {
				flags: {
					name: {
						brief:
							"Name of the principal. Defaults to URL-safe root package.json name. Mutually exclusive with prefix",
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
					prefix: {
						brief:
							"Prefix for the principal. Defaults to 'dev'. Mutually exclusive with name",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
				},
			},
			docs: {
				brief: "Create an AWS organization for the current account",
			},
		});
};
