import { buildCommand } from "@stricli/core";
import Enquirer from "enquirer";
import VError from "verror";
import { AwsOIDC } from "../../../../../sdk/aws/clients/AwsOIDC.mjs";
import { AwsPolicy } from "../../../../../sdk/aws/clients/AwsPolicy.mjs";
import { AwsRole } from "../../../../../sdk/aws/clients/AwsRole.mjs";
import { PackageJsonRepositoryName } from "../../../../context/PackageJson.mjs";
import {
	PrefixPrincipal,
	type PrefixPrincipalFlags,
	PrefixPrincipalParameterFlags,
} from "../../../../flags/PrefixPrincipal.mjs";
import { RunAwsPrincipalFarAssumeSequence } from "../../../../sequences/aws/principal/AwsPrincipalAssumeSequence.mjs";

const enquirer = new Enquirer();
const prompt = enquirer.prompt.bind(enquirer);

type Flags = {
	repository?: string;
	region: string;
} & PrefixPrincipalFlags;

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

export const AwsCodebuildOIDCRole = `FourtwoOIDCProviderRole`;
export const AwsCodebuildOIDCParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/codebuild/oidc/OIDCProviderArn`;

export const AwsCodebuildOidcCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					const {
						region,
						prefix,
						principal: principalFlag,
						repository,
					} = flags;
					const principal = await new PrefixPrincipal(
						{
							prefix,
							principal: principalFlag,
						},
						{ required: true },
					).build();

					let { assumed, parameters, account } =
						await RunAwsPrincipalFarAssumeSequence({
							principal,
							region,
						});

					const oidcClient = new AwsOIDC(assumed);
					const policies = new AwsPolicy(assumed);
					const roles = new AwsRole(assumed);

					let repo = repository ?? (await PackageJsonRepositoryName());

					if (!repo) {
						throw new VError(
							{
								name: "REPO_NOT_FOUND",
								message: "Repository name not found",
							},
							"No repository was specified with the --repository flag, and the repository name could not be found in package.json",
						);
					}

					{
						let provider: Awaited<
							ReturnType<typeof oidcClient.CreateOpenIDConnectProvider>
						>["CreateOpenIDConnectProviderResult"];
						provider = (
							await oidcClient.CreateOpenIDConnectProvider(
								{
									Url: "https://token.actions.githubusercontent.com",
									ClientIdList: ["sts.amazonaws.com"],
									ThumbprintList: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
								},
								{ iam: account ?? "<account-arn>" },
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

						let service: Awaited<ReturnType<typeof roles.CreateRole>>;
						service = await roles.CreateRole(
							{
								RoleName: AwsCodebuildOIDCRole,
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
							{ iam: account ?? "<account-arn>" },
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

						let oidc = (
							await parameters.next({
								template: AwsCodebuildOIDCParameter,
								principal,
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
					}
				};
			},
			parameters: {
				flags: {
					...PrefixPrincipalParameterFlags(),
					repository: {
						brief: "Repository to create OIDC provider for",
						kind: "parsed",
						parse: (value: string) => {
							if (value.trim().length === 0) {
								throw new VError(
									{
										name: "INVALID_FLAG",
										info: {
											flag: "repository",
											value: value,
										},
									},
									"Repository name cannot be empty",
								);
							}

							if (
								!value.startsWith("https://") ||
								!value.includes("github.com")
							) {
								throw new VError(
									{
										name: "INVALID_FLAG",
										info: {
											flag: "repository",
											value: value,
										},
									},
									"Repository name must be a valid github repository",
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
