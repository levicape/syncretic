import { buildCommand } from "@stricli/core";
import { AwsClient } from "aws4fetch";
import VError from "verror";
import { AwsClientBuilder } from "../../../../sdk/aws/AwsClientBuilder.mjs";
import { AwsKms } from "../../../../sdk/aws/clients/AwsKms.mjs";
import { AwsOrganizations } from "../../../../sdk/aws/clients/AwsOrganizations.mjs";
import {
	AwsPolicy,
	type RolePolicy,
} from "../../../../sdk/aws/clients/AwsPolicy.mjs";
import { AwsRole } from "../../../../sdk/aws/clients/AwsRole.mjs";
import { AwsS3 } from "../../../../sdk/aws/clients/AwsS3.mjs";
import {
	PrefixPrincipal,
	type PrefixPrincipalFlags,
	PrefixPrincipalParameterFlags,
} from "../../../flags/PrefixPrincipal.mjs";
import {
	UniqueIdReplace,
	UniqueIdReplaceDefaultParseArn,
	UniqueIdReplaceDefaultResourceName,
	type UniqueIdReplaceFlags,
	UniqueIdReplaceParameterFlags,
} from "../../../flags/UniqueIdReplace.mjs";
import { RunAwsPrincipalFarAssumeSequence } from "../../../sequences/aws/principal/AwsPrincipalAssumeSequence.mjs";
import { AwsCodebuildOIDCParameter } from "../codebuild/github/AwsCodebuildGithubOidcCommand.mjs";
import {
	AwsOrganizationPrincipalFARParameter,
	AwsOrganizationPrincipalOAAParameter,
} from "../organization/AwsOrganizationPrincipalCommand.mjs";

type Flags = {
	region: string;
} & UniqueIdReplaceFlags<boolean> &
	PrefixPrincipalFlags;

export type PulumiBackendCommandReturn = {
	pulumi: {
		backend: {
			url: `s3:${string}`;
			key: `awskms:${string}`;
		};
	};
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

const IAM_CONSISTENCY_DELAY = CONSISTENCY_DELAY("IAM", 6000);

export const AwsPulumiBackendReaderRole = `FourtwoPulumiBackendReaderRole`;
export const AwsStateBackendReaderRoleParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/pulumi/backend/${AwsPulumiBackendReaderRole}Arn`;
export const AwsPulumiBackendReaderPolicy = ({
	bucket,
}: {
	bucket: string;
}): RolePolicy => {
	return {
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				Action: [
					"s3:GetObject",
					"s3:GetObjectVersion",
					"s3:GetBucketVersioning",
					"s3:GetBucketLocation",
					"s3:GetBucketPolicy",
					"s3:ListBucket",
					"s3:ListBucketVersions",
					"s3:ListBucketMultipartUploads",
					"s3:ListMultipartUploadParts",
				],
				Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`],
			},
		],
	};
};

export const AwsPulumiBackendWriterRole = `FourtwoPulumiBackendWriterRole`;
export const AwsStateBackendWriterRoleParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/pulumi/backend/${AwsPulumiBackendWriterRole}Arn`;
export const AwsPulumiBackendWriterPolicy = ({
	bucket,
}: {
	bucket: string;
}): RolePolicy => {
	return {
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				Action: [
					"s3:GetObject",
					"s3:GetObjectVersion",
					"s3:GetBucketVersioning",
					"s3:GetBucketLocation",
					"s3:GetBucketPolicy",
					"s3:ListBucket",
					"s3:ListBucketVersions",
					"s3:ListBucketMultipartUploads",
					"s3:ListMultipartUploadParts",
					"s3:PutObject",
					"s3:PutObjectAcl",
					"s3:DeleteObjectVersion",
				],
				Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`],
			},
		],
	};
};

export const AwsStateBackendBucketNameParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/pulumi/backend/StateBackendBucketName`;

export const AwsStateBackendEncryptionKeyParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/pulumi/backend/StateBackendEncryptionKeyArn`;

export const AwsStateBackendEncryptionKeyAlias = (principal?: string) =>
	`alias/fourtwo/pulumi/backend/${principal}`;

export const AwsStateBackendCommandsParameter = (principal?: string) =>
	`/fourtwo/${principal ? `${principal}` : "_principal"}/pulumi/backend/StateBackendCommandReference`;

export const AwsPulumiBackendCommand = async () => {
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
					} = flags;

					const organizations = new AwsOrganizations(
						new AwsClient({
							...(await AwsClientBuilder.getAWSCredentials()),
						}),
					);

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
						let bucketNameParameter = (
							await parameters.next({
								template: AwsStateBackendBucketNameParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (bucketNameParameter?.$$kind !== "loaded") {
							throw new VError(
								{
									message: "INVALID_STATE",
									info: {
										Expected: "Loaded",
										Received: JSON.stringify(bucketNameParameter),
									},
								},
								"Bucket name parameter could not be loaded",
							);
						}

						let previousId =
							bucketNameParameter?.parameter.scoped?.value?.Parameter.Value;

						if (previousId) {
							console.dir(
								{
									AwsPulumiBackendCommand: {
										message: "Found previous bucket name",
										previousId,
									},
								},
								{ depth: null },
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
										bucketNameParameter?.parameter.scoped?.value?.Parameter
											.Value,
									),
									parse: UniqueIdReplaceDefaultParseArn,
									named: UniqueIdReplaceDefaultResourceName,
								},
							},
						);

						const { uniqueId, previousUniqueId } =
							await uniqueIdReplace.build();

						if (uniqueId === previousUniqueId && replace) {
							throw new VError(
								{
									name: "INVALID_STATE",
									message: "Unique ID is the same as previous ID",
								},
								"Unique ID is the same as previous ID",
							);
						}

						let [
							[readerRoleParameter, readerRole],
							[writerRoleParameter, writerRole],
							[_farParam, farRole],
							[_oaaParam, oaaRole],
							[_oidcParam, oidcRole],
						] = (
							await Promise.all([
								Promise.all([
									parameters.next({
										template: AwsStateBackendReaderRoleParameter,
										principal,
									}),
									parameters.next(),
								]),
								Promise.all([
									parameters.next({
										template: AwsStateBackendWriterRoleParameter,
										principal,
									}),
									parameters.next(),
								]),
								Promise.all([
									parameters.next({
										template: AwsOrganizationPrincipalFARParameter,
										principal,
									}),
									parameters.next(),
								]),
								Promise.all([
									parameters.next({
										template: AwsOrganizationPrincipalOAAParameter,
										principal,
									}),
									parameters.next(),
								]),
								Promise.all([
									parameters.next({
										template: AwsCodebuildOIDCParameter,
										principal: principal,
									}),
									parameters.next(),
								]),
							])
						).map(([parameter]) => {
							if (parameter.value?.$$kind !== "loaded") {
								throw new VError(
									{
										name: "INVALID_STATE",
										message: "Parameter could not be loaded",
										info: {
											Received: JSON.stringify(parameter),
										},
									},
									"Parameter could not be loaded",
								);
							}

							return [
								parameter.value,
								parameter.value.parameter.scoped?.value?.Parameter.Value.split(
									":",
								)
									.at(-1)
									?.split("/")[1],
							];
						});

						const s3 = new AwsS3(assumed);
						let bucketLocation =
							bucketNameParameter?.parameter.scoped?.value?.Parameter.Value;

						if (!bucketLocation || replace) {
							const pulumiBackendBucket = await s3.CreateBucket({
								BucketName: (await uniqueIdReplace.scoped("pulumi-backend"))
									.resourceName,
							});

							bucketLocation =
								pulumiBackendBucket.Bucket.Location !== null
									? pulumiBackendBucket.Bucket.Location
									: undefined;
						}

						await bucketNameParameter.update(bucketLocation!);

						console.dir(
							{
								AwsPulumiBackendCommand: {
									message: "Pulumi backend bucket",
									bucketLocation,
								},
							},
							{ depth: null },
						);

						const roles = new AwsRole(assumed);
						const policies = new AwsPolicy(assumed);
						await Promise.all(
							(
								[
									[
										[readerRole, AwsPulumiBackendReaderRole],
										readerRoleParameter,
										AwsPulumiBackendReaderPolicy,
										(named: string) => {
											readerRole = named;
										},
									],
									[
										[writerRole, AwsPulumiBackendWriterRole],
										writerRoleParameter,
										AwsPulumiBackendWriterPolicy,
										(named: string) => {
											writerRole = named;
										},
									],
								] as const
							).map(
								async ([
									[roleName, roleDefaultName],
									parameter,
									policy,
									setLocalVariable,
								]) => {
									{
										if (roleName === "undefined") {
											roleName = undefined;
										}

										if (roleName) {
											console.dir(
												{
													AwsPulumiBackendCommand: {
														message: `Role ${roleName} already exists`,
													},
												},
												{ depth: null },
											);
										}

										if (!roleName) {
											console.dir({
												AwsPulumiBackendCommand: {
													message: `Role ${roleDefaultName} not found. Creating`,
												},
											});
											roleName = roleDefaultName;
										}

										let role = await roles.CreateRole(
											{
												RoleName: roleName!,
												AssumeRolePolicyDocument: JSON.stringify({
													Version: "2012-10-17",
													Statement: [
														{
															Effect: "Allow",
															Action: "sts:AssumeRole",
															Principal: {
																AWS: [
																	`arn:aws:iam::${org.Organization.MasterAccountId}:root`,
																	`arn:aws:iam::${account}:root`,
																],
																Federated: [
																	"sts.amazonaws.com",
																	`arn:aws:iam::${account}:oidc-provider/tokens.action.githubusercontent.com`,
																],
															},
														},
													],
												}),
											},
											{ iam: account ?? "<account-arn>" },
										);

										console.dir(
											{
												AwsPulumiBackendCommand: {
													message: `Role ${roleName}`,
													role,
												},
											},
											{ depth: null },
										);

										if (role.$kind === "new") {
											await IAM_CONSISTENCY_DELAY();
										}

										console.dir(
											{
												AwsPulumiBackendCommand: {
													message: `Role ${roleName}: Updating role policy`,
												},
											},
											{ depth: null },
										);

										await policies.PutRolePolicy({
											PolicyDocument: policy({
												bucket: bucketLocation!,
											}),
											PolicyName: roleName!,
											RoleName: roleName!,
										});

										await IAM_CONSISTENCY_DELAY();

										let roleArn = role.CreateRoleResult.Role.Arn;
										console.dir(
											{
												AwsPulumiBackendCommand: {
													message: `Role ${roleName}: Updating parameters`,
													roleArn,
												},
											},
											{ depth: null },
										);
										await parameter.update(roleArn);

										setLocalVariable(roleName!);

										console.dir(
											{
												AwsPulumiBackendCommand: {
													message: `Role ${roleName}`,
													role,
													roleArn,
												},
											},
											{ depth: null },
										);
									}
								},
							),
						);

						let kms = new AwsKms(
							new AwsClient({
								...assumed,
								region: "us-east-1",
							}),
						);
						let encryptionKeyParameter = (
							await parameters.next({
								template: AwsStateBackendEncryptionKeyParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (encryptionKeyParameter?.$$kind !== "loaded") {
							throw new VError(
								{
									message: "INVALID_STATE",
									info: {
										Expected: "Loaded",
										Received: JSON.stringify(encryptionKeyParameter),
									},
								},
								"Encryption key parameter could not be loaded",
							);
						}

						let arnForRole = (roleName: string) =>
							`arn:aws:iam::${account}:role/${roleName}`;
						let encryptionKey =
							encryptionKeyParameter?.parameter.scoped?.value?.Parameter.Value;
						let aliases = await kms.ListAliases({});

						if (encryptionKey) {
							let exists = aliases.Aliases.some(
								(alias) =>
									alias.TargetKeyId === encryptionKey &&
									alias.AliasName ===
										AwsStateBackendEncryptionKeyAlias(principal),
							);

							console.dir(
								{
									AwsPulumiBackendCommand: {
										message: "Found previous encryption key",
										encryptionKey,
										exists,
									},
								},
								{ depth: null },
							);

							if (!exists) {
								console.dir(
									{
										AwsPulumiBackendCommand: {
											message:
												"Encryption key does not exist on this account, the existing parameter will be replaced, regardless of replace flag",
											encryptionKey,
										},
									},
									{ depth: null },
								);
								encryptionKey = undefined;
							}
						}

						if (!encryptionKey || replace) {
							for (let alias of aliases.Aliases) {
								if (
									alias.TargetKeyId &&
									alias.AliasName ===
										AwsStateBackendEncryptionKeyAlias(principal)
								) {
									await kms.DeleteAlias({
										AliasName: alias.AliasName,
									});

									await kms.DisableKey({
										KeyId: alias.TargetKeyId,
									});
								}
							}

							// TODO: FT Builder Assume Policy
							let key = await kms.CreateKey({
								Description: `Pulumi backend key for ${principal}`,
								Policy: JSON.stringify({
									Version: "2012-10-17",
									Statement: [
										{
											Effect: "Allow",
											Principal: {
												AWS: [
													`arn:aws:iam::${org.Organization.MasterAccountId}:root`,
													`arn:aws:iam::${account}:root`,
													...(oaaRole ? [arnForRole(oaaRole)] : []),
													...(farRole ? [arnForRole(farRole)] : []),
													...(writerRole ? [arnForRole(writerRole)] : []),
												],
												Federated: [
													"sts.amazonaws.com",
													`arn:aws:iam::${account}:oidc-provider/tokens.action.githubusercontent.com`,
												],
											},
											Action: ["kms:*"],
											Resource: "*",
										},
										{
											Effect: "Allow",
											Principal: {
												AWS: [
													...(oidcRole ? [arnForRole(oidcRole)] : []),
													...(readerRole ? [arnForRole(readerRole)] : []),
												],
											},
											Action: [
												"kms:Describe*",
												"kms:List*",
												"kms:Get*",
												"kms:ReEncrypt*",
												"kms:GenerateDataKey*",
												"kms:Encrypt",
												"kms:Decrypt",
											],
											Resource: "*",
										},
									],
								} satisfies RolePolicy),
							});

							console.dir(
								{
									AwsPulumiBackendCommand: {
										message: "Encryption key created",
										key,
									},
								},
								{ depth: null },
							);

							await kms.CreateAlias({
								AliasName: AwsStateBackendEncryptionKeyAlias(principal),
								TargetKeyId: key.KeyMetadata.KeyId,
							});

							console.dir(
								{
									AwsPulumiBackendCommand: {
										message: "Encryption key alias created",
										key: key.KeyMetadata.KeyId,
										alias: AwsStateBackendEncryptionKeyAlias(principal),
									},
								},
								{ depth: null },
							);

							await encryptionKeyParameter.update(key.KeyMetadata.KeyId);

							console.dir(
								{
									AwsPulumiBackendCommand: {
										message: "Encryption key parameter updated",
										key: key.KeyMetadata.KeyId,
									},
								},
								{ depth: null },
							);

							encryptionKey = key.KeyMetadata.KeyId;
						}
						// SSE
						await s3.PutBucketEncryption({
							BucketName: bucketLocation!,
							EncryptionConfiguration: {
								EncryptionType: "aws:kms",
								KmsKeyId: encryptionKey,
							},
							ExpectedBucketOwner: account,
						});

						console.dir({
							AwsPulumiBackendCommand: {
								message: "Encryption key",
								encryptionKey,
							},
						});

						// Versioning
						await s3.PutBucketVersioning({
							BucketName: bucketLocation!,
							VersioningConfiguration: {
								Status: "Enabled",
							},
							ExpectedBucketOwner: account,
						});

						console.dir({
							AwsPulumiBackendCommand: {
								message: "Versioning enabled",
							},
						});

						// Public Access
						await s3.PutPublicAccessBlock({
							BucketName: bucketLocation!,
							PublicAccessBlockConfiguration: {
								BlockPublicAcls: true,
								BlockPublicPolicy: true,
								IgnorePublicAcls: true,
								RestrictPublicBuckets: true,
							},
							ExpectedBucketOwner: account,
						});

						console.dir({
							AwsPulumiBackendCommand: {
								message: "Public access blocked",
							},
						});

						console.dir(
							{
								AwsPulumiBackendCommand: {
									message: "Pulumi backend initialized and configured.",
									principal,
									region,
									encryptionKey,
									bucketLocation,
								},
							},
							{ depth: null },
						);

						let commands: PulumiBackendCommandReturn = {
							pulumi: {
								backend: {
									url: `s3:/${bucketLocation}?region=us-east-1`,
									key: `awskms://${encryptionKey}?region=us-east-1&awssdk=v2`,
								},
							},
						};

						let commandsParameter = (
							await parameters.next({
								template: AwsStateBackendCommandsParameter,
								principal,
							})
						).value;
						await parameters.next();

						if (commandsParameter?.$$kind !== "loaded") {
							throw new VError(
								{
									message: "INVALID_STATE",
									info: {
										Expected: "Loaded",
										Received: JSON.stringify(commandsParameter),
									},
								},
								"Commands parameter could not be loaded",
							);
						}

						await commandsParameter.update(JSON.stringify(commands));

						console.dir(
							{
								AwsPulumiBackendCommand: {
									message: "Pulumi backend commands",
									commands,
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
					...UniqueIdReplaceParameterFlags(),
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
					"Set up a KMS encrypted S3 bucket and create roles for a new Pulumi state backend.",
			},
		});
};
