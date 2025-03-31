import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Certificate } from "@pulumi/aws/acm";
import { CertificateValidation } from "@pulumi/aws/acm/certificateValidation";
import {
	User,
	UserGroup,
	UserPool,
	type UserPoolArgs,
} from "@pulumi/aws/cognito";
import { UserInGroup } from "@pulumi/aws/cognito/userInGroup";
import { UserPoolDomain } from "@pulumi/aws/cognito/userPoolDomain";
import { getOrganization } from "@pulumi/aws/organizations/getOrganization";
import { Provider } from "@pulumi/aws/provider";
import { Record as DnsRecord } from "@pulumi/aws/route53";
import { Parameter } from "@pulumi/aws/ssm";
import { type Output, all, interpolate } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import { RandomId, RandomPassword } from "@pulumi/random";
import type { z } from "zod";
import { objectEntries, objectFromEntries } from "../../Object";
import { $deref } from "../../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../../application/exports";
import {
	FourtwoDnsRootStackExportsZod,
	FourtwoDnsRootStackrefRoot,
} from "../../dns/root/exports";
import {
	FourtwoIdpUsersCognitoDomain,
	FourtwoIdpUsersStackExportsZod,
} from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo";
const COGNITO_ROOT_DOMAIN = FourtwoIdpUsersCognitoDomain;

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? FourtwoApplicationRoot;
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		application: {
			refs: {
				servicecatalog:
					FourtwoApplicationStackExportsZod.shape
						.fourtwo_application_servicecatalog,
			},
		},
		[FourtwoDnsRootStackrefRoot]: {
			refs: {
				acm: FourtwoDnsRootStackExportsZod.shape.fourtwo_dns_root_acm,
				route53: FourtwoDnsRootStackExportsZod.shape.fourtwo_dns_root_route53,
			},
		},
	},
};

const usEast1Provider = new Provider("us-east-1", {
	region: "us-east-1",
});

export = async () => {
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	const organization = await getOrganization({});
	const pools = (() => {
		const userpool = (name: string, config: UserPoolArgs) => {
			const pool = new UserPool(
				_(`${name}`),
				{
					userPoolTier: "LITE",
					aliasAttributes: ["preferred_username"],
					usernameConfiguration: {
						caseSensitive: false,
					},
					tags: {
						Name: _(`${name}`),
						PackageName: PACKAGE_NAME,
					},
					...config,
				},
				{
					replaceOnChanges: ["alias_atributes"],
				},
			);

			let currentPrecedence = 0;
			const usergroup = (usergroupName: string) =>
				new UserGroup(_(`${name}-${usergroupName}`), {
					description: `(${PACKAGE_NAME}) ${name} group for ${usergroupName}. [Precedence: ${currentPrecedence}]`,
					userPoolId: pool.id,
					precedence: currentPrecedence++,
				});

			const user = (username: string, groupName: string, group: UserGroup) => {
				const randomid = new RandomId(
					_(`${name}-${groupName}-${username}-id`),
					{
						byteLength: 4,
					},
				);
				const password = new RandomPassword(
					_(`${name}-${groupName}-${username}-password`),
					{
						length: 16,
						minNumeric: 2,
						minLower: 2,
						minSpecial: 2,
						minUpper: 2,
						keepers: {
							randomid: randomid.hex,
						},
					},
				);

				const passwordParameter = new Parameter(
					_(`${name}-${groupName}-${username}-parameter`),
					{
						type: "SecureString",
						value: password.result,
						overwrite: true,
						tags: {
							Name: _(`${name}-${groupName}-${username}-password`),
							PackageName: PACKAGE_NAME,
						},
					},
				);

				const ownerEmail = organization.masterAccountEmail.split("@")[0];
				const ownerDomain = organization.masterAccountEmail.split("@")[1];
				const userEmail = interpolate`${ownerEmail}+${organization.masterAccountId}_${username}_${group.name}_${randomid.hex}@${ownerDomain}`;
				const user = new User(_(`${name}-${groupName}-${username}`), {
					userPoolId: pool.id,
					username: interpolate`${username}_${groupName}-${randomid.hex}`,
					attributes: {
						email: userEmail,
						sub: userEmail,
						preferred_username: `${username}_${groupName}`,
					},
					desiredDeliveryMediums: ["EMAIL"],
					forceAliasCreation: true,
					messageAction: "SUPPRESS",
					password: password.result,
				});

				const userInGroup = new UserInGroup(
					_(`${name}-${groupName}-${username}-registration`),
					{
						userPoolId: pool.id,
						username: user.username,
						groupName: group.name,
					},
				);

				return {
					user,
					passwordParameter,
					userInGroup,
				};
			};

			const groups = ["super", "editor"].map((groupName) => {
				const group = usergroup(groupName);
				const canary = user("canary", groupName, group);

				return {
					group,
					canary,
				};
			});

			const { acm, route53 } = dereferenced$[FourtwoDnsRootStackrefRoot];
			const domainName = (() => {
				const domainName = acm.certificate?.domainName;
				if (domainName?.startsWith("*.")) {
					return domainName.slice(2);
				}
				return domainName;
			})();

			/**
			/**
			 * Certificate for *.idp.az domain
			 */
			const cognitoDomain = `${COGNITO_ROOT_DOMAIN}.${domainName}`;

			let cognitoCertificate: Certificate | undefined;
			let cognitoCertificateValidations:
				| Output<{
						records: DnsRecord[];
						validations: CertificateValidation[];
				  }>
				| undefined;

			if (route53.zone !== undefined && route53.zone !== null) {
				cognitoCertificate = new Certificate(
					_(`${name}-certificate`),
					{
						domainName: `*.${cognitoDomain}`,
						subjectAlternativeNames: [cognitoDomain],
						validationMethod: "DNS",
						tags: {
							Name: _(`${name}-certificate`),
							HostedZoneId: route53.zone.hostedZoneId,
							HostedZoneArn: route53.zone.arn,
							PackageName: PACKAGE_NAME,
						},
					},
					{ provider: usEast1Provider },
				);

				cognitoCertificateValidations =
					cognitoCertificate.domainValidationOptions.apply((options) => {
						const uniqueOptions = options.filter((option, index, self) => {
							return (
								index ===
								self.findIndex(
									(o) =>
										o.resourceRecordType === option.resourceRecordType &&
										o.resourceRecordName === option.resourceRecordName &&
										o.resourceRecordValue === option.resourceRecordValue,
								)
							);
						});

						const records = uniqueOptions.map((validationOption, index) => {
							return new DnsRecord(_(`${name}-valid-${index}`), {
								type: validationOption.resourceRecordType,
								ttl: 60,
								zoneId: route53.zone?.hostedZoneId ?? "",
								name: validationOption.resourceRecordName,
								records: [validationOption.resourceRecordValue],
							});
						});

						const validations = records.map((validation, _index) => {
							return new CertificateValidation(
								_(`${name}-validation-${_index}`),
								{
									certificateArn: cognitoCertificate?.arn ?? "",
									validationRecordFqdns: [validation.fqdn],
								},
								{ provider: usEast1Provider },
							);
						});

						return {
							records,
							validations,
						};
					});
			}

			let domain: UserPoolDomain | undefined;
			let records:
				| {
						ip4: DnsRecord | undefined;
						ip6: DnsRecord | undefined;
				  }
				| undefined;

			if (
				route53.zone !== undefined &&
				route53.zone !== null &&
				cognitoCertificate
			) {
				const fullSubdomain = `${name}.${COGNITO_ROOT_DOMAIN}`;
				const domainFqdn = `${fullSubdomain}.${domainName}`;

				const required = new DnsRecord(_(`${name}-dns-azc`), {
					zoneId: route53.zone.hostedZoneId,
					name: fullSubdomain.split(".").slice(1).join("."),
					type: "A",
					ttl: 6000,
					records: ["8.8.8.8"],
				});

				domain = new UserPoolDomain(
					_(`${name}-domain`),
					{
						certificateArn: cognitoCertificate.arn,
						domain: domainFqdn,
						userPoolId: pool.id,
					},
					{
						dependsOn: [required],
					},
				);

				records = {
					ip4: new DnsRecord(
						_(`${name}-dns-a`),
						{
							zoneId: route53.zone.hostedZoneId,
							name: fullSubdomain,
							type: "A",
							aliases: [
								{
									name: domain.cloudfrontDistribution,
									zoneId: domain.cloudfrontDistributionZoneId,
									evaluateTargetHealth: false,
								},
							],
						},
						{
							deleteBeforeReplace: true,
						},
					),
					ip6: new DnsRecord(
						_(`${name}-dns-aaaa`),
						{
							zoneId: route53.zone.hostedZoneId,
							name: fullSubdomain,
							type: "AAAA",
							aliases: [
								{
									name: domain.cloudfrontDistribution,
									zoneId: domain.cloudfrontDistributionZoneId,
									evaluateTargetHealth: false,
								},
							],
						},
						{
							deleteBeforeReplace: true,
						},
					),
				};
			}

			return {
				pool,
				groups,
				certificate: cognitoCertificate,
				validations: cognitoCertificateValidations,
				domain,
				records,
			};
		};

		return {
			operators: userpool("operators", {
				adminCreateUserConfig: {
					allowAdminCreateUserOnly: true,
				},
			}),
		};
	})();

	const userpoolsOutput = all(objectEntries(pools)).apply((entries) =>
		objectFromEntries(
			entries.map(([name, { pool, domain, records }]) => [
				name,
				all([
					pool.arn,
					pool.name,
					pool.id,
					pool.userPoolTier,
					context.environment.aws?.region ??
						"<context.environment.aws?.region>",
					domain !== undefined
						? all([
								domain.certificateArn,
								domain.domain,
								domain.userPoolId,
								domain.version,
								domain.cloudfrontDistribution,
								domain.cloudfrontDistributionZoneId,
							]).apply(
								([
									certificateArn,
									domain,
									userPoolId,
									version,
									cloudfrontDistribution,
									cloudfrontDistributionZoneId,
								]) => ({
									certificateArn,
									domain,
									userPoolId,
									version,
									cloudfrontDistribution,
									cloudfrontDistributionZoneId,
								}),
							)
						: undefined,
					records?.ip4 !== undefined
						? all([
								records.ip4.id,
								records.ip4.name,
								records.ip4.zoneId,
								records.ip4.type,
								records.ip4.fqdn,
								// Typescript will infer the above as nullable, so we cast these to non-nullable before applying
								records.ip6?.id as Output<string>,
								records.ip6?.name as Output<string>,
								records.ip6?.zoneId as Output<string>,
								records.ip6?.type as Output<string>,
								records.ip6?.fqdn as Output<string>,
							]).apply(
								([
									ip4Id,
									ip4Name,
									ip4ZoneId,
									ip4Type,
									ip4Fqdn,
									ip6Id,
									ip6Name,
									ip6ZoneId,
									ip6Type,
									ip6Fqdn,
								]) => ({
									ip4: {
										id: ip4Id,
										name: ip4Name,
										zoneId: ip4ZoneId,
										type: ip4Type,
										fqdn: ip4Fqdn,
									},
									...(ip6Id !== undefined
										? {
												ip6: {
													id: ip6Id,
													name: ip6Name,
													zoneId: ip6ZoneId,
													type: ip6Type,
													fqdn: ip6Fqdn,
												},
											}
										: {}),
								}),
							)
						: undefined,
				]).apply(([arn, name, id, userPoolTier, region, domain, record]) => ({
					pool: {
						arn,
						name,
						id,
						region,
						userPoolTier,
					},
					domain,
					record,
				})),
			]),
		),
	);

	return all([userpoolsOutput]).apply(([userpools]) => {
		const exported = {
			fourtwo_idp_users_cognito: {
				operators: userpools.operators,
			},
		} satisfies z.infer<typeof FourtwoIdpUsersStackExportsZod>;

		const validate = FourtwoIdpUsersStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
