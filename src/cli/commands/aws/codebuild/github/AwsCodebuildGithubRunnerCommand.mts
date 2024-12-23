import { buildCommand } from "@stricli/core";
import VError from "verror";
import {
	AwsCodebuild,
	type CodebuildCreateProjectRequest,
} from "../../../../../sdk/aws/clients/AwsCodebuild.mjs";
import { AwsPolicy } from "../../../../../sdk/aws/clients/AwsPolicy.mjs";
import { AwsS3 } from "../../../../../sdk/aws/clients/AwsS3.mjs";
import { PackageJsonRepositoryName } from "../../../../context/PackageJson.mjs";
import {
	PrefixPrincipal,
	type PrefixPrincipalFlags,
	PrefixPrincipalParameterFlags,
} from "../../../../flags/PrefixPrincipal.mjs";
import {
	UniqueIdReplace,
	UniqueIdReplaceDefaultParseArn,
	UniqueIdReplaceDefaultResourceName,
	type UniqueIdReplaceFlags,
} from "../../../../flags/UniqueIdReplace.mjs";
import { WaitForReadySequence } from "../../../../sequences/WaitForReadySequence.mjs";
import { RunAwsPrincipalFarAssumeSequence } from "../../../../sequences/aws/principal/AwsPrincipalFarAssumeSequence.mjs";
import { AwsCodebuildGithubAuthCredentialsParameter } from "./AwsCodebuildGithubAuthCommand.mjs";
import { AwsCodebuildOIDCParameter } from "./AwsCodebuildGithubOidcCommand.mjs";

type Flags = {
	region: string;
	username?: string;
	source?: `s3://${string}` | `github://${string}`;
} & UniqueIdReplaceFlags<boolean> &
	PrefixPrincipalFlags;

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

export const AwsCodebuildGithubRunnerArtifactsBucketParameter = (
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
					const {
						region,
						prefix,
						principal: principalFlag,
						replace,
						uniqueId: uniqueIdFlag,
						username,
						source,
					} = flags;
					const principal = await new PrefixPrincipal(
						{ prefix, principal: principalFlag },
						{
							required: true,
						},
					).build();

					let { assumed, parameters, account } =
						await RunAwsPrincipalFarAssumeSequence({
							principal,
							region,
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
								template: AwsCodebuildOIDCParameter,
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
									message: `OIDC role not found. Expected parameter: ${AwsCodebuildOIDCParameter(
										principal,
									)}. Please run \`fourtwo aws codebuild github oidc\` to initialize the required role.`,
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

						let uniqueIdReplace = new UniqueIdReplace(
							{
								uniqueId: uniqueIdFlag,
								replace,
							},
							{
								region,
								parameter: {
									value: Promise.resolve(
										projectParameter?.parameter.scoped?.value?.Parameter.Value,
									),
									parse: UniqueIdReplaceDefaultParseArn,
									named: UniqueIdReplaceDefaultResourceName,
								},
							},
						);

						const { uniqueId, previousUniqueId } =
							await uniqueIdReplace.build();

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
								template: AwsCodebuildGithubRunnerArtifactsBucketParameter,
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

						let bucketLocation =
							artifactsParameter?.parameter.scoped?.value?.Parameter.Value;

						if (!bucketLocation) {
							const artifacts = await s3.CreateBucket({
								BucketName: (
									await uniqueIdReplace.scoped("gha-runner-artifacts")
								).resourceName,
							});
							bucketLocation =
								artifacts.Bucket.Location !== null
									? artifacts.Bucket.Location
									: undefined;
							await artifactsParameter.update(bucketLocation!);
						}

						console.dir(
							{
								AwsCodebuildGithubRunnerCommand: {
									message: "Codebuild artifact bucket",
									bucketLocation,
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

								let serviceprincipal = (
									s.Principal as {
										Service?: string;
									}
								)?.Service;

								const isCodebuild =
									serviceprincipal !== undefined &&
									serviceprincipal === "codebuild.amazonaws.com";
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

							await WaitForReadySequence("Codebuild permissions", {
								isReady: async () => {
									const role = await policy.GetRole({
										RoleName: oidcRole.split("/").pop()!,
									});
									return role.GetRoleResult.Role.AssumeRolePolicyDocument.Statement.some(
										(s) => {
											const isAssumeRole = s.Action === "sts:AssumeRole";

											let awsprincipal = (
												s.Principal as {
													AWS?: string | string[];
												}
											)?.AWS;
											if (awsprincipal !== undefined) {
												return false;
											}

											let serviceprincipal = (
												s.Principal as {
													Service?: string;
												}
											)?.Service;

											const isCodebuild =
												serviceprincipal !== undefined &&
												serviceprincipal === "codebuild.amazonaws.com";
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

						let uniqueCodebuildName = (
							await uniqueIdReplace.scoped(`project-a64-lambda-nodejs20`)
						).resourceName;
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
								artifacts: bucketLocation
									? {
											type: "S3",
											location: bucketLocation.replaceAll("/", ""),
											packaging: "NONE",
											bucketOwnerAccess: "FULL",
											namespaceType: "BUILD_ID",
										}
									: {
											type: "NO_ARTIFACTS",
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
									message: "Updated Codebuild Webhook",
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
					...PrefixPrincipalParameterFlags(),
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
				},
			},
			docs: {
				brief:
					"Set up an AWS Codebuild project to run Github Actions workflows",
			},
		});
};
