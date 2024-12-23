import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import Enquirer from "enquirer";
import VError from "verror";
import { AwsClientBuilder } from "../../../../sdk/aws/AwsClientBuilder.mjs";
import { AwsOrganizations } from "../../../../sdk/aws/clients/AwsOrganizations.mjs";
import { AwsPolicy } from "../../../../sdk/aws/clients/AwsPolicy.mjs";
import { AwsRole } from "../../../../sdk/aws/clients/AwsRole.mjs";
import { AwsSystemsManager } from "../../../../sdk/aws/clients/AwsSystemsManager.mjs";
import { AwsSystemsManagerParameterGenerator } from "../../../../sdk/aws/generators/AwsSystemsManagerParameterGenerator.mjs";
import {
	PrefixPrincipal,
	type PrefixPrincipalFlags,
	PrefixPrincipalParameterFlags,
} from "../../../flags/PrefixPrincipal.mjs";
import { WaitForReadySequence } from "../../../sequences/WaitForReadySequence.mjs";

const enquirer = new Enquirer();
const prompt = enquirer.prompt.bind(enquirer);

type Flags = {
	email?: string;
	region: string;
} & PrefixPrincipalFlags;

const IAM_CONSISTENCY_DELAY = 5000;

export const AwsOrganizationPrincipalOAARole = "OrganizationAccountAccessRole";
export const AwsOrganizationPrincipalOAAParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/organization/principal/OrganizationAccountAccessRoleArn`;
export const AwsOrganizationPrincipalFAR = "FourtwoAccessRole";
export const AwsOrganizationPrincipalFARParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/organization/principal/FourtwoAccessRoleArn`;

export const AwsOrganizationPrincipalCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					let { principal: principalFlag, email, region, prefix } = flags;

					const credentials = await AwsClientBuilder.getAWSCredentials();
					const client = new AwsClient({
						...credentials,
						region,
					});
					const organizations = new AwsOrganizations(client);
					let roles = new AwsRole(client);
					const root = new AwsSystemsManager(client);

					const principalName = await new PrefixPrincipal(
						{ prefix: prefix, principal: principalFlag },
						{ required: true },
					).build();

					let principal:
						| { Id: string; Name: string; Email: string }
						| undefined;

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
					const accounts = await organizations.ListAccounts();
					console.dir(
						{
							PrincipalCommand: {
								message: "Organization:",
								org,
								principalName,
								accounts: accounts.Accounts.map((account) => ({
									Name: account.Name,
									Email: account.Email,
									Status: account.Status,
								})),
							},
						},
						{ depth: null },
					);
					if (
						accounts.Accounts.find(
							(account) => account.Name === principalName,
						) !== undefined
					) {
						console.dir({
							PrincipalCommand: {
								message: "Account already exists",
								principalName,
							},
						});

						principal = accounts.Accounts.find(
							(account) => account.Name === principalName,
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
							message: `Create account principal ${principalName}?`,
						})) as { proceed?: boolean };

						if (!response?.proceed) {
							return;
						}

						let { CreateAccountStatus } = await organizations.CreateAccount({
							AccountName: principalName,
							Email: email,
							RoleName: AwsOrganizationPrincipalOAARole,
						});
						console.dir({
							PrincipalCommand: {
								message: "Account created",
								CreateAccountStatus,
							},
						});

						await WaitForReadySequence("account", {
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
							Name: principalName,
							Email: email,
						};
					}

					await new Promise((resolve) =>
						setTimeout(resolve, IAM_CONSISTENCY_DELAY),
					);

					const { AssumedRoleUser, Credentials } = (
						await roles.AssumeRole({
							RoleArn: `arn:aws:iam::${principal?.Id}:role/${AwsOrganizationPrincipalOAARole}`,
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

					const policies = new AwsPolicy(assumed);
					roles = new AwsRole(assumed);

					let farRole: Awaited<ReturnType<typeof roles.CreateRole>>;
					farRole = await roles.CreateRole(
						{
							RoleName: AwsOrganizationPrincipalFAR,
							AssumeRolePolicyDocument: JSON.stringify({
								Version: "2012-10-17",
								Statement: [
									{
										Effect: "Allow",
										Action: "sts:AssumeRole",
										Principal: {
											AWS: [
												`arn:aws:iam::${org.Organization.MasterAccountId}:root`,
												`arn:aws:iam::${org.Organization.MasterAccountId}:role/OrganizationAccountAccessRole`,
											],
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
									farRole.$kind === "new"
										? "Created Role"
										: "Role already exists",
								farRole,
							},
						},
						{ depth: null },
					);
					await new Promise((resolve) =>
						setTimeout(resolve, IAM_CONSISTENCY_DELAY),
					);

					let policy: Awaited<ReturnType<typeof policies.PutRolePolicy>>;
					policy = await policies.PutRolePolicy({
						RoleName: farRole.CreateRoleResult.Role.RoleName,
						PolicyName: "FourtwoFARRolePolicy",
						PolicyDocument: {
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Action: "*",
									Resource: "*",
								},
								// AwsCodebuildGithubRunnerCommandPolicyStatement,
								// AwsSystemsManagerParametersPolicyStatement,
								// AwsPulumiPolicyStatement,
							],
						},
					});

					console.dir(
						{
							PrincipalCommand: {
								message: "Updated role policy FourtwoFARRolePolicy",
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

					let farParameter = (
						await parameters.next({
							template: AwsOrganizationPrincipalFARParameter,
							principal: principalName,
						})
					).value;
					if (farParameter?.$$kind !== "loaded") {
						throw new VError(
							{
								name: "INVALID_STATE",
							},
							`Please verify: \n${JSON.stringify({ farParameter }, null, 2)}`,
						);
					}
					await parameters.next();

					await farParameter?.update(farRole.CreateRoleResult.Role.Arn);

					console.dir(
						{
							PrincipalCommand: {
								message: "Updated Fourtwo Access Role parameter",
								farParameter,
							},
						},
						{ depth: null },
					);

					let oaa = (
						await parameters.next({
							template: AwsOrganizationPrincipalOAAParameter,
							principal: principalName,
						})
					).value;
					if (oaa?.$$kind !== "loaded") {
						throw new VError(
							{
								name: "INVALID_STATE",
							},
							`Please verify: \n${JSON.stringify({ oaa }, null, 2)}`,
						);
					}
					await parameters.next();

					await oaa?.update(AwsOrganizationPrincipalOAARole);

					console.dir(
						{
							PrincipalCommand: {
								message: "Updated Organization Access role parameters",
								oaa,
							},
						},
						{ depth: null },
					);
				};
			},
			parameters: {
				flags: {
					...PrefixPrincipalParameterFlags(),
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
				brief: "Create a new account for the current AWS organization",
			},
		});
};
