import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import VError from "verror";
import { Codebuild, Policy } from "../../../index.mjs";
import { AwsClientBuilder } from "../../../sdk/AwsClientBuilder.mjs";
import { Role } from "../../../sdk/aws/Role.mjs";
import { S3 } from "../../../sdk/aws/S3.mjs";
import { SystemsManager } from "../../../sdk/aws/SystemsManager.mjs";
import {
	PrincipalOIDCParameter,
	principalName,
	repositoryName,
	waitForReady,
} from "./PrincipalCommand.mjs";

type Flags = {
	account: string;
	region: string;
	token: string;
	uniqueId?: string;
	source?: `s3://${string}` | `github://${string}`;
	role?: string;

	type?: string;
	image?: string;
	compute?: string;
};

export const DeveloperProjectParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/CodebuildProjectArn`;

export const DeveloperCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (flags: Flags) => {
					const { account, region, role, token, source } = flags;
					const credentials = await AwsClientBuilder.getAWSCredentials();
					const client = new AwsClient({
						...credentials,
						region,
					});
					let roles = new Role(client);

					const serviceRole = role ?? "OrganizationAccountAccessRole";
					const { AssumedRoleUser, Credentials } = (
						await roles.AssumeRole({
							RoleArn: `arn:aws:iam::${account}:role/${serviceRole}`,
							RoleSessionName: "FourtwoDeveloperCommand",
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
							region: flags.region,
						});
						roles = new Role(assumed);

						const codebuild = new Codebuild(assumed);
						const systems = new SystemsManager(assumed);
						const policy = new Policy(assumed);
						const principal = await principalName();
						const s3 = new S3(assumed);
						let uniqueId =
							flags.uniqueId ?? Math.random().toString(36).substring(4);

						// const sources = await s3.CreateBucket({
						// 	BucketName: `fourtwo-${uniqueId}-source`,
						// });

						const artifacts = await s3.CreateBucket({
							BucketName: `fourtwo-${uniqueId}-artifacts`,
						});

						const state = await s3.CreateBucket({
							BucketName: `fourtwo-${uniqueId}-state`,
						});

						const logs = await s3.CreateBucket({
							BucketName: `fourtwo-${uniqueId}-logs`,
						});

						console.dir(
							{
								DeveloperCommand: {
									message: "Created buckets",
									// sources,
									artifacts,
									state,
									logs,
								},
							},
							{ depth: null },
						);

						const oidcParameter = PrincipalOIDCParameter(principal);
						const oidcRole = (
							await systems.GetParameter({
								Name: oidcParameter,
							})
						)?.Parameter.Value;

						console.dir({
							DeveloperCommand: {
								message: "Got OIDC role",
								oidcRole,
							},
						});

						if (!oidcRole) {
							throw new VError(
								{
									name: "OIDC",
									message: `OIDC role not found. Expected parameter: ${oidcParameter}. Please run \`paloma aws principal\` to initialize the required role.`,
								},
								"OIDC role not found",
							);
						}

						const credentials = await codebuild.ImportSourceCredentials({
							serverType: "GITHUB",
							authType: "PERSONAL_ACCESS_TOKEN",
							token,
						});
						console.dir(
							{
								DeveloperCommand: {
									message: "Imported source credentials",
									credentials,
								},
							},
							{ depth: null },
						);

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
									DeveloperCommand: {
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
								DeveloperCommand: {
									message: "Added Codebuild permissions to role",
									oidcRole,
								},
							});
						}

						let uniqueCodebuildName = `fourtwo-${uniqueId}-a64-lambda-nodejs20`;
						if (uniqueCodebuildName.length > 150) {
							uniqueCodebuildName = uniqueCodebuildName.slice(0, 150);
						}

						const projectSource = !source
							? ({
									type: "GITHUB",
									auth: {
										type: "OAUTH",
										resource: credentials.arn,
									},
									location: `https://github.com/${await repositoryName()}`,
								} as const)
							: await (async () => {
									// Check s3 and parse
									throw new VError("Not implemented");
								})();

						const { project } = await codebuild.CreateProject(
							{
								name: uniqueCodebuildName,
								source: projectSource,
								artifacts: {
									type: "S3",
									location: artifacts.Bucket.Location!.replaceAll("/", ""),
									packaging: "NONE",
									bucketOwnerAccess: "FULL",
								},
								environment: {
									type: "ARM_LAMBDA_CONTAINER",
									image:
										"aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs22",
									computeType: "BUILD_LAMBDA_1GB",
								},
								serviceRole: oidcRole,
								tags: [
									{
										key: "Fourtwo",
										value: "Project",
									},
								],
							},
							{ iam: account },
						);

						console.dir(
							{
								DeveloperCommand: {
									message: project.source
										? "Created project"
										: "Project already exists",
									project,
								},
							},
							{ depth: null },
						);

						let parameter = DeveloperProjectParameter();
						let scopedParameter = DeveloperProjectParameter(
							await principalName(),
						);

						let existing: Awaited<ReturnType<typeof systems.GetParameter>>;
						existing = await systems.GetParameter({
							Name: parameter,
						});

						let updateParameter = existing?.Parameter?.Value !== project.arn;

						if (updateParameter) {
							let param: Awaited<ReturnType<typeof systems.PutParameter>>;
							param = await systems.PutParameter({
								Name: parameter,
								Value: project.arn,
								Type: "String",
								Overwrite: true,
							});

							await systems.PutParameter({
								Name: scopedParameter,
								Value: project.arn,
								Type: "String",
								Overwrite: true,
							});

							console.dir(
								{
									PrincipalCommand: {
										message: "Updated project parameter",
										param,
									},
								},
								{ depth: null },
							);
						} else {
							console.dir(
								{
									PrincipalCommand: {
										message: "Project parameter already up-to-date",
										existing,
									},
								},
								{ depth: null },
							);
						}
					}
				};
			},
			parameters: {
				flags: {
					account: {
						brief: "AWS Account ID",
						kind: "parsed",
						parse: (value: string) => value,
						optional: false,
					},
					role: {
						brief: "Role to assume. Defaults to OrganizationAccountAccessRole",
						kind: "parsed",
						parse: (value: string) => value,
						optional: true,
					},
					region: {
						brief: "AWS Region",
						kind: "parsed",
						parse: (value: string) => value,
						optional: false,
					},
					token: {
						brief: "Token type",
						kind: "parsed",
						parse: (value: string) => value,
						optional: false,
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
				},
			},
			docs: {
				brief:
					"Set up a project with Codebuild, Github Actions, Elastic Container Registry and 2 buckets",
			},
		});
};
