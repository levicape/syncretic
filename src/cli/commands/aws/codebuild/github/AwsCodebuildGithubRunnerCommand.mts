import { buildCommand } from "@stricli/core";
import VError from "verror";
import {
	AwsCodebuild,
	type CodebuildCreateProjectRequest,
} from "../../../../../sdk/aws/clients/AwsCodebuild.mjs";
import { AwsPolicy } from "../../../../../sdk/aws/clients/AwsPolicy.mjs";
import { AwsS3 } from "../../../../../sdk/aws/clients/AwsS3.mjs";
import {
	AwsPrincipalNameFromPackageJson,
	PackageJsonRepositoryName,
} from "../../../../context/PackageJson.mjs";
import { RunAwsPrincipalOaaAssumeSequence } from "../../../../sequences/aws/AwsPrincipalOaaAssumeSequence.mjs";
import {
	AwsOrganizationPrincipalOIDCParameter,
	waitForReady,
} from "../../organization/AwsOrganizationPrincipalCommand.mjs";
import { AwsCodebuildGithubAuthCredentialsParameter } from "./AwsCodebuildGithubAuthCommand.mjs";

type Flags = {
	region: string;
	username?: string;
	uniqueId?: string;
	replace?: boolean;
	source?: `s3://${string}` | `github://${string}`;
	prefix?: string;
	role: string;
};

const CONSISTENCY_DELAY = (label: string, time: number) => async () => {
	return new Promise<void>((resolve) => {
		console.dir({
			ConsistencyDelay: {
				message: `Waiting for ${label} to be consistent`,
				time,
			},
		});
		setTimeout(() => {
			resolve();
		}, time);
	});
};

const IAM_CONSISTENCY_DELAY = CONSISTENCY_DELAY("IAM", 8000);
const CODEBUILD_CONSISTENCY_DELAY = CONSISTENCY_DELAY("CODEBUILD", 10000);

export const AwsCodebuildGithubRunnerRoleParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/codebuild/github/runner/OidcRoleArn`;

export const AwsCodebuildGithubRunnerArtifactsParameter = (
	principal?: string,
) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/codebuild/github/runner/ArtifactsBucketName`;

export const AwsCodebuildGithubRunnerProjectParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/codebuild/github/runner/CodebuildProjectArn`;

export const AwsCodebuildGithubRunnerRunsOnParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/codebuild/github/runner/RunsOnTemplate`;

export const AwsCodebuildGithubRunnerCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					const { region, prefix, username, replace, source, role } = flags;
					const principal = await AwsPrincipalNameFromPackageJson({
						prefix,
					});

					let { assumed, parameters, account } =
						await RunAwsPrincipalOaaAssumeSequence({
							principal,
							region,
							role,
						});

					if (!account) {
						throw new VError(
							{
								name: "Account",
								message: "No account found %s",
							},
							"No account found",
							JSON.stringify({ account, assumed }),
						);
					}
					{
						const s3 = new AwsS3(assumed);

						const oidcParameter = (
							await parameters.next({
								template: AwsOrganizationPrincipalOIDCParameter,
								principal,
							})
						).value;
						if (
							oidcParameter.$$kind !== "loaded" ||
							oidcParameter?.parameter.scoped?.value === undefined
						) {
							throw new VError(
								{
									name: "OIDC",
									message: `OIDC role not found. Expected parameter: ${AwsOrganizationPrincipalOIDCParameter(
										principal,
									)}. Please run \`paloma aws principal\` to initialize the required role.`,
								},
								"OIDC role not found",
							);
						}
						await parameters.next();

						const oidcRole =
							oidcParameter?.parameter.scoped.value?.Parameter.Value;
						console.dir({
							AwsCodebuildGithubRunnerCommand: {
								message: "Got OIDC role",
								oidcRole,
							},
						});

						let projectParameter = (
							await parameters.next({
								template: AwsCodebuildGithubRunnerProjectParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (projectParameter?.$$kind !== "loaded") {
							throw new VError(
								"Project parameter not found %s",
								projectParameter,
							);
						}

						let previousId =
							projectParameter?.parameter.scoped?.value?.Parameter.Value;

						if (previousId) {
							console.dir(
								{
									AwsCodebuildGithubRunnerCommand: {
										message: "Found previous project",
										previousId,
									},
								},
								{ depth: null },
							);
						}

						let previousUniqueId = previousId?.split(":")[5]?.split("-")[1];
						let uniqueId =
							(flags.uniqueId ?? replace)
								? Math.random().toString(36).substring(4)
								: (previousUniqueId ?? Math.random().toString(36).substring(4));

						let credentialsParameter = (
							await parameters.next({
								template: AwsCodebuildGithubAuthCredentialsParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (credentialsParameter?.$$kind !== "loaded") {
							throw new VError(
								"Credentials parameter not found %s",
								credentialsParameter,
							);
						}

						if (
							uniqueId !== previousUniqueId &&
							!credentialsParameter?.parameter.scoped?.value
						) {
							throw new VError(
								{
									name: "credentials",
									message:
										"No source credentials found. Credentials must be configured for each principal account with `fourtwo aws codebuild github auth`.",
								},
								"No source credentials found",
							);
						}

						let artifactsParameter = (
							await parameters.next({
								template: AwsCodebuildGithubRunnerArtifactsParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (artifactsParameter?.$$kind !== "loaded") {
							throw new VError(
								"Artifacts parameter not found %s",
								artifactsParameter,
							);
						}

						const artifacts = await s3.CreateBucket({
							BucketName: `fourtwo-${uniqueId}-artifacts`,
						});

						await artifactsParameter.update(artifacts.Bucket.Location!);

						console.dir(
							{
								AwsCodebuildGithubRunnerCommand: {
									message: "Codebuild artifact bucket",
									artifacts,
								},
							},
							{ depth: null },
						);

						//
						const codebuild = new AwsCodebuild(assumed);
						const policy = new AwsPolicy(assumed);

						const assumeRolePolicy = (
							await policy.GetRole({
								RoleName: oidcRole.split("/").pop()!,
							})
						).GetRoleResult.Role.AssumeRolePolicyDocument;

						if (
							assumeRolePolicy.Statement.some((s) => {
								const isAssumeRole = s.Action === "sts:AssumeRole";
								const isCodebuild =
									s.Principal?.Service !== undefined &&
									s.Principal?.Service === "codebuild.amazonaws.com";
								return s.Effect === "Allow" && isAssumeRole && isCodebuild;
							})
						) {
							console.dir(
								{
									AwsCodebuildGithubRunnerCommand: {
										message: "Role already has Codebuild permissions",
									},
								},
								{ depth: null },
							);
						} else {
							await policy.UpdateAssumeRolePolicy({
								RoleName: oidcRole.split("/").pop()!,
								PolicyDocument: {
									Version: "2012-10-17",
									Statement: [
										...assumeRolePolicy.Statement,
										{
											Effect: "Allow",
											Principal: {
												Service: "codebuild.amazonaws.com",
											},
											Action: "sts:AssumeRole",
										},
									],
								},
							});

							await waitForReady("Codebuild permissions", {
								isReady: async () => {
									const role = await policy.GetRole({
										RoleName: oidcRole.split("/").pop()!,
									});
									return role.GetRoleResult.Role.AssumeRolePolicyDocument.Statement.some(
										(s) => {
											const isAssumeRole = s.Action === "sts:AssumeRole";
											const isCodebuild =
												s.Principal?.Service !== undefined &&
												s.Principal?.Service === "codebuild.amazonaws.com";
											return (
												s.Effect === "Allow" && isAssumeRole && isCodebuild
											);
										},
									);
								},
							});

							console.dir({
								AwsCodebuildGithubRunnerCommand: {
									message: "Added Codebuild permissions to role",
									oidcRole,
								},
							});
						}

						await IAM_CONSISTENCY_DELAY();

						let uniqueCodebuildName = `fourtwo-${uniqueId}-a64-lambda-nodejs20`;
						if (uniqueCodebuildName.length > 150) {
							uniqueCodebuildName = uniqueCodebuildName.slice(0, 150);
						}

						const projectSource = !source
							? ({
									type: "GITHUB",
									auth: {
										type: "OAUTH",
										resource:
											credentialsParameter?.parameter.scoped?.value?.Parameter
												.Value,
									},
									gitCloneDepth: 1,
									location: `CODEBUILD_DEFAULT_WEBHOOK_SOURCE_LOCATION`,
								} satisfies CodebuildCreateProjectRequest<"ARM_LAMBDA_CONTAINER">["source"])
							: await (async () => {
									// Check s3 and parse
									throw new VError("Not implemented");
								})();

						const { project } = await codebuild.CreateProject(
							{
								name: uniqueCodebuildName,
								description: `Project for building ${await PackageJsonRepositoryName()}`,
								source: projectSource,
								artifacts: {
									type: "S3",
									location: artifacts.Bucket.Location!.replaceAll("/", ""),
									packaging: "NONE",
									bucketOwnerAccess: "FULL",
									namespaceType: "BUILD_ID",
								},
								// vpcConfig: {},
								environment: {
									type: "ARM_LAMBDA_CONTAINER",
									image:
										"aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs20",
									computeType: "BUILD_LAMBDA_4GB",
								},
								serviceRole: oidcRole,
								tags: [
									{
										key: "Fourtwo",
										value: flags.prefix ?? "dev",
									},
								],
							},
							{ iam: account },
						);

						console.dir(
							{
								AwsCodebuildGithubRunnerCommand: {
									message: project.source
										? "Created project"
										: "Project already exists",
									project,
								},
							},
							{ depth: null },
						);

						if (!username) {
							console.dir(
								{
									AwsCodebuildGithubRunnerCommand: {
										message: "No username provided",
									},
								},
								{ depth: null },
							);
						}

						const webhook = await codebuild.CreateWebhook({
							projectName: uniqueCodebuildName,
							filterGroups: [
								[
									{
										type: "EVENT",
										pattern: "WORKFLOW_JOB_QUEUED",
									},
									...(username
										? [
												{
													type: "ACTOR_ACCOUNT_ID",
													pattern: username,
												} as const,
											]
										: []),
								],
							],
							// TODO: Allow --filepath
							scopeConfiguration: {
								name: (await PackageJsonRepositoryName())!.split("/")[0],
								scope: "GITHUB_ORGANIZATION",
							},
							buildType: "BUILD",
						});

						console.dir(
							{
								AwsCodebuildGithubRunnerCommand: {
									message: " Updated Codebuild Webhook",
									webhook,
								},
							},
							{ depth: null },
						);

						await CODEBUILD_CONSISTENCY_DELAY();

						await projectParameter?.update(project.arn);

						let runsOnParameter = (
							await parameters.next({
								template: AwsCodebuildGithubRunnerRunsOnParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (runsOnParameter?.$$kind !== "loaded") {
							throw new VError(
								"RunsOn parameter not found %s",
								runsOnParameter,
							);
						}

						let runsOn = `codebuild-${project.name}-\${{ github.run_id }}-\${{ github.run_attempt }}`;
						await runsOnParameter?.update(encodeURIComponent(runsOn));

						console.dir({
							AwsCodebuildGithubRunnerCommand: {
								message: "Codebuild project created and linked.",
								project,
								usage: `runs-on: ${runsOn}`,
								example: {
									Name:
										runsOnParameter?.parameter.scoped?.value?.Parameter.Name ??
										AwsCodebuildGithubRunnerRunsOnParameter(principal),
									Value: runsOn,
								},
							},
						});
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
					username: {
						brief: "Username",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
					role: {
						brief: "Role to assume. Defaults to OrganizationAccountAccessRole",
						kind: "parsed",
						parse: (value: string) => value,
						default: "OrganizationAccountAccessRole",
					},
					uniqueId: {
						brief: "Unique ID",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
					source: {
						brief: "Source",
						kind: "parsed",
						parse: (value: string) => {
							if (value.startsWith("s3://")) {
								return `s3://${value}`;
							}
							if (value.startsWith("github://")) {
								return `github://${value}`;
							}
							throw new VError(
								{
									name: "source",
									message: "Invalid source",
								},
								"Invalid source",
							);
						},
						optional: true,
					},
					replace: {
						brief: "Replace",
						kind: "boolean",
						optional: true,
					},
					prefix: {
						brief: "Prefix for the principal. Defaults to 'dev'",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
				},
			},
			docs: {
				brief:
					"Set up an AWS Codebuild project to run Github Actions workflows",
			},
		});
};
