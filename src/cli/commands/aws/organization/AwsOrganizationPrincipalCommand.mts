import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import Enquirer from "enquirer";
import VError from "verror";
import { AwsClientBuilder } from "../../../../sdk/aws/AwsClientBuilder.mjs";
import { AwsOIDC } from "../../../../sdk/aws/clients/AwsOIDC.mjs";
import { AwsOrganizations } from "../../../../sdk/aws/clients/AwsOrganizations.mjs";
import { AwsPolicy } from "../../../../sdk/aws/clients/AwsPolicy.mjs";
import { AwsRole } from "../../../../sdk/aws/clients/AwsRole.mjs";
import { AwsSystemsManager } from "../../../../sdk/aws/clients/AwsSystemsManager.mjs";
import { AwsSystemsManagerParameterGenerator } from "../../../../sdk/aws/generators/AwsSystemsManagerParameterGenerator.mjs";
import {
	AwsPrincipalNameFromPackageJson,
	PackageJsonRepositoryName,
} from "../../../context/PackageJson.mjs";

const enquirer = new Enquirer();
const prompt = enquirer.prompt.bind(enquirer);

type Flags = {
	name?: string;
	email?: string;
	prefix: string;
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

export const AwsOrganizationPrincipalOIDCRole = `FourtwoOIDCProviderRole`;
export const AwsOrganizationPrincipalOIDCParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/organization/principal/OIDCProviderArn`;
export const AwsOrganizationPrincipalOAARole = "OrganizationAccountAccessRole";
export const AwsOrganizationPrincipalOAAParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/organization/principal/OrganizationAccountAccessRoleArn`;

export const AwsOrganizationPrincipalCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					let { name, email, region, prefix } = flags;

					const credentials = await AwsClientBuilder.getAWSCredentials();
					const client = new AwsClient({
						...credentials,
						region,
					});
					const organizations = new AwsOrganizations(client);
					let roles = new AwsRole(client);
					const root = new AwsSystemsManager(client);

					const org = await organizations.DescribeOrganization();
					if (!org) {
						throw new VError(
							{
								name: "PrincipalCommand",
								message: "Organization not found",
							},
							"Organization not found. Please create an organization first with `fourtwo aws organization init`",
						);
					}

					if (name && prefix) {
						throw new VError(
							{
								name: "PrincipalCommand",
								message: "Name and prefix are mutually exclusive",
							},
							"Name and prefix are mutually exclusive",
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

					if (!name && !prefix) {
						throw new VError(
							{
								name: "PrincipalCommand",
								message: "Name or prefix is required",
							},
							"Name or prefix is required",
						);
					}

					name = name ?? (await AwsPrincipalNameFromPackageJson({ prefix }));
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
							RoleName: AwsOrganizationPrincipalOAARole,
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

					const serviceRole = AwsOrganizationPrincipalOAARole;
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

					const assumed = new AwsClient({
						accessKeyId: Credentials.AccessKeyId,
						secretAccessKey: Credentials.SecretAccessKey,
						sessionToken: Credentials.SessionToken,
						region,
					});

					const oidcClient = new AwsOIDC(assumed);
					const policies = new AwsPolicy(assumed);
					roles = new AwsRole(assumed);

					let repo = await PackageJsonRepositoryName();

					if (!repo) {
						console.dir({
							PrincipalCommand: {
								message: "Skipping OIDC, repository not found",
							},
						});
					} else {
						let provider: Awaited<
							ReturnType<typeof oidcClient.CreateOpenIDConnectProvider>
						>["CreateOpenIDConnectProviderResult"];
						provider = (
							await oidcClient.CreateOpenIDConnectProvider(
								{
									Url: "https://token.actions.githubusercontent.com",
									ClientIdList: ["sts.amazonaws.com"],
									ThumbprintList: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
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

						const oidcRole = AwsOrganizationPrincipalOIDCRole;
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
												// https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect
												StringLike: {
													"token.actions.githubusercontent.com:sub": `repo:${repo}:ref:refs/heads/main`,
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

						let parameters = AwsSystemsManagerParameterGenerator({
							root,
							systems: new AwsSystemsManager(assumed),
						});
						await parameters.next();

						let oidc = (
							await parameters.next({
								template: AwsOrganizationPrincipalOIDCParameter,
								principal: name,
							})
						).value;
						if (oidc?.$$kind !== "loaded") {
							throw new VError(
								{
									name: "OIDC_NOT_FOUND",
									message: "OIDC role parameter not found. ",
								},
								`OIDC role parameter not found ${JSON.stringify(oidc)}`,
							);
						}
						await parameters.next();

						await oidc?.update(service.CreateRoleResult.Role.Arn);

						console.dir(
							{
								PrincipalCommand: {
									message: "Updated OIDC role parameter",
									oidc,
								},
							},
							{ depth: null },
						);

						let oaa = (
							await parameters.next({
								template: AwsOrganizationPrincipalOAAParameter,
								principal: name,
							})
						).value;
						if (oaa?.$$kind !== "loaded") {
							throw new VError(
								{
									name: "OAA_NOT_FOUND",
									message: "OAA role parameter not found. ",
								},
								`OAA role parameter not found ${JSON.stringify({
									oaa,
								})}`,
							);
						}
						await parameters.next();

						await oaa?.update(service.CreateRoleResult.Role.Arn);

						console.dir(
							{
								PrincipalCommand: {
									message: "Updated Organization Access role parameters",
									oaa,
								},
							},
							{ depth: null },
						);
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
							"Prefix for the principal. Mutually exclusive with name. Must be set if name is not set",
						kind: "parsed",
						parse: (value: string) => value,
					},
				},
			},
			docs: {
				brief: "Create an AWS organization for the current account",
			},
		});
};
