import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Certificate, CertificateValidation } from "@pulumi/aws/acm";
import {
	UserPoolClient,
	type UserPoolClientArgs,
} from "@pulumi/aws/cognito/userPoolClient";
import { UserPoolDomain } from "@pulumi/aws/cognito/userPoolDomain";
import { Provider } from "@pulumi/aws/provider";
import { Record as DnsRecord } from "@pulumi/aws/route53";
import { Record } from "@pulumi/aws/route53/record";
import { type Output, all } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import type { z } from "zod";
import { $deref } from "../../../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../../../application/exports";
import {
	FourtwoDnsRootStackExportsZod,
	FourtwoDnsRootStackrefRoot,
} from "../../../dns/root/exports";
import {
	FourtwoIdentityUsersStackExportsZod,
	FourtwoIdentityUsersStackrefRoot,
} from "../../../identity/users/exports";
import { FourtwoPanelWWWRootSubdomain } from "../wwwroot/exports";
import {
	FourtwoPanelClientOauthCallbackRoute,
	FourtwoPanelClientStackExportsZod,
} from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo";
const SUBDOMAIN =
	process.env["STACKREF_SUBDOMAIN"] ?? FourtwoPanelWWWRootSubdomain;
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
		[FourtwoIdentityUsersStackrefRoot]: {
			refs: {
				cognito:
					FourtwoIdentityUsersStackExportsZod.shape
						.fourtwo_identity_users_cognito,
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

	const { cognito } = dereferenced$[FourtwoIdentityUsersStackrefRoot];
	const { acm, route53 } = dereferenced$[FourtwoDnsRootStackrefRoot];
	const domainName = (() => {
		const domainName = acm.certificate?.domainName;
		if (domainName?.startsWith("*.")) {
			return domainName.slice(2);
		}
		return domainName;
	})();

	/**
	 * Certificate for *.azc domain
	 */
	const cognitoDomain = `azc.${SUBDOMAIN}.${domainName}`;

	let cognitoCertificate: Certificate | undefined;
	let cognitoCertificateValidations:
		| Output<{
				records: Record[];
				validations: CertificateValidation[];
		  }>
		| undefined;

	if (route53.zone !== undefined && route53.zone !== null) {
		cognitoCertificate = new Certificate(
			_(`certificate`),
			{
				domainName: `*.${cognitoDomain}`,
				subjectAlternativeNames: [cognitoDomain],
				validationMethod: "DNS",
				tags: {
					Name: _("certificate"),
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
					return new Record(_(`validation-record-${index}`), {
						type: validationOption.resourceRecordType,
						ttl: 60,
						zoneId: route53.zone!.hostedZoneId,
						name: validationOption.resourceRecordName,
						records: [validationOption.resourceRecordValue],
					});
				});

				const validations = records.map((validation, _index) => {
					return new CertificateValidation(
						_(`certificate-validation`),
						{
							certificateArn: cognitoCertificate!.arn,
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

	/**
	 * Cognito User Pool Clients
	 */
	const clients = (() => {
		const userpoolclient = (
			name: string,
			config?: Omit<UserPoolClientArgs, "userPoolId">,
		) => {
			const userPoolId = cognito.operations.pool.id;
			/**
			 * Subdomain relative to the hosted zone
			 */
			const fullSubdomain = `${name}.azc.${SUBDOMAIN}`;
			const domainFqdn = `${fullSubdomain}.${domainName}`;
			const client = new UserPoolClient(_(`${name}-client`), {
				userPoolId,
				callbackUrls: [`https://${domainFqdn}`].map(
					(url) => `${url}/${FourtwoPanelClientOauthCallbackRoute}`,
				),
				allowedOauthFlowsUserPoolClient: true,
				allowedOauthFlows: ["code", "implicit"],
				allowedOauthScopes: ["email", "openid", "profile"],
				supportedIdentityProviders: ["COGNITO"],
				...(config ?? {}),
			});

			if (cognitoCertificate !== undefined) {
				if (route53.zone !== undefined && route53.zone !== null) {
					const required = new DnsRecord(_(`${name}-dns-azc`), {
						zoneId: route53.zone.hostedZoneId,
						name: fullSubdomain.split(".").slice(1).join("."),
						type: "A",
						ttl: 6000,
						records: ["8.8.8.8"],
					});

					const domain = new UserPoolDomain(
						_(`${name}-domain`),
						{
							certificateArn: cognitoCertificate.arn,
							domain: domainFqdn,
							userPoolId: userPoolId,
						},
						{
							dependsOn: all([
								cognitoCertificateValidations?.validations,
							]).apply(([ccv]) => [
								required,
								cognitoCertificate,
								...(ccv ?? []),
							]),
						},
					);

					const records = {
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

					return { client, domain, records };
				}
			}

			return { client };
		};

		return {
			operations: userpoolclient("operations"),
		};
	})();

	const clientsOutput = all(Object.entries(clients)).apply((entries) =>
		Object.fromEntries(
			entries.map(([name, { client, domain, records }]) => [
				name,
				all([
					all([client.id, client.name, client.userPoolId]).apply(
						([id, clientId, userPoolId]) => ({
							id,
							clientId,
							userPoolId,
						}),
					),
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
					records !== undefined
						? all([
								records.ip4.id,
								records.ip4.name,
								records.ip4.zoneId,
								records.ip4.type,
								records.ip4.fqdn,
								records.ip6.id,
								records.ip6.name,
								records.ip6.zoneId,
								records.ip6.type,
								records.ip6.fqdn,
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
									ip6: {
										id: ip6Id,
										name: ip6Name,
										zoneId: ip6ZoneId,
										type: ip6Type,
										fqdn: ip6Fqdn,
									},
								}),
							)
						: undefined,
				]).apply(([client, domain, record]) => {
					return {
						client,
						domain,
						record,
					};
				}),
			]),
		),
	);

	return all([clientsOutput]).apply(([clients]) => {
		const exported = {
			fourtwo_panel_client_cognito: {
				operations: clients.operations,
			},
		} satisfies z.infer<typeof FourtwoPanelClientStackExportsZod>;

		const validate = FourtwoPanelClientStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
