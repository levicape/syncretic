import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Certificate } from "@pulumi/aws/acm";
import { CertificateValidation } from "@pulumi/aws/acm/certificateValidation";
import { Provider } from "@pulumi/aws/provider";
import { Zone } from "@pulumi/aws/route53";
import { Record } from "@pulumi/aws/route53/record";
import { error, warn } from "@pulumi/pulumi/log";
import { all } from "@pulumi/pulumi/output";
import type { z } from "zod";
import { $deref } from "../../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../../application/exports";
import { FourtwoDnsRootStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo";
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
	},
};

export = async () => {
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	const domainName = (() => {
		const hostname = context.frontend?.dns?.hostnames?.[0] ?? undefined;
		return hostname?.replace(/[^a-zA-Z0-9-.]/g, "-");
	})();

	if (!domainName) {
		error(
			`No domain name found in the context. Please check your configuration.`,
		);
		return {
			fourtwo_dns_root_route53: {},
			fourtwo_dns_root_acm: {},
		} satisfies z.infer<typeof FourtwoDnsRootStackExportsZod>;
	}

	const hostedZone = new Zone(_("hosted-zone"), {
		name: domainName,
		forceDestroy: true,
		comment: `Root zone for ${context.prefix} application (${PACKAGE_NAME})`,
		tags: {
			Name: _("hosted-zone"),
			PackageName: PACKAGE_NAME,
		},
	});

	const usEast1Provider = new Provider("us-east-1", {
		region: "us-east-1",
	});

	const certificate = new Certificate(
		_("certificate"),
		{
			domainName: `*.${domainName}`,
			subjectAlternativeNames: [domainName],
			validationMethod: "DNS",
			tags: {
				Name: _("certificate"),
				HostedZoneId: hostedZone.id,
				HostedZoneArn: hostedZone.arn,
				PackageName: PACKAGE_NAME,
			},
		},
		{ provider: usEast1Provider },
	);

	const validation = certificate.domainValidationOptions.apply((options) => {
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
				zoneId: hostedZone.id,
				name: validationOption.resourceRecordName,
				records: [validationOption.resourceRecordValue],
			});
		});

		const validations = records.map((validation, _index) => {
			return new CertificateValidation(
				_("certificate-validation"),
				{
					certificateArn: certificate.arn,
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

	const route53Output = all([
		hostedZone.zoneId,
		hostedZone.name,
		validation.records.apply((records) => {
			return records.map((record) =>
				all([
					record.id,
					record.name,
					record.type,
					record.ttl,
					record.zoneId,
					record.records,
					record.fqdn,
					record.healthCheckId,
				]).apply(
					([id, name, type, ttl, zoneId, records, fqdn, healthCheckId]) => {
						return {
							id,
							name,
							type,
							ttl,
							zoneId,
							records,
							fqdn,
							healthCheckId,
						};
					},
				),
			);
		}),
		hostedZone.arn,
		hostedZone.comment,
		hostedZone.nameServers,
	]).apply(
		([hostedZoneId, hostedZoneName, records, arn, comment, nameServers]) => {
			return {
				zone: {
					hostedZoneId,
					hostedZoneName,
					records,
					arn,
					comment,
					nameServers,
				},
			};
		},
	);

	const acmOutput = all([
		all([
			certificate.arn,
			certificate.domainName,
			certificate.subjectAlternativeNames,
			certificate.keyAlgorithm,
			certificate.notAfter,
			certificate.notBefore,
			certificate.renewalEligibility,
			certificate.status,
		]).apply(
			([
				arn,
				domainName,
				subjectAlternativeNames,
				keyAlgorithm,
				notAfter,
				notBefore,
				renewalEligibility,
				status,
			]) => {
				return {
					arn,
					domainName,
					subjectAlternativeNames,
					keyAlgorithm,
					notAfter,
					notBefore,
					renewalEligibility,
					status,
				};
			},
		),
		certificate.renewalSummaries.apply((summaries) => {
			return summaries.map((summary) =>
				all([
					summary.renewalStatus,
					summary.renewalStatusReason,
					summary.updatedAt,
				]).apply(([renewalStatus, renewalStatusReason, updatedAt]) => {
					return {
						renewalStatus,
						renewalStatusReason,
						updatedAt,
					};
				}),
			);
		}),
		validation.validations.apply((validations) => {
			return validations.map((validation) =>
				all([
					validation.certificateArn,
					validation.validationRecordFqdns,
					validation.id,
				]).apply(([certificateArn, validationRecordFqdns, id]) => {
					return {
						certificateArn,
						validationRecordFqdns,
						id,
					};
				}),
			);
		}),
	]).apply(([certificate, renewalSummaries, validations]) => {
		return {
			certificate,
			renewalSummaries,
			validations,
		};
	});

	return all([route53Output, acmOutput]).apply(([route53, acm]) => {
		const exported = {
			fourtwo_dns_root_route53: route53,
			fourtwo_dns_root_acm: acm,
		} satisfies z.infer<typeof FourtwoDnsRootStackExportsZod>;

		const validate = FourtwoDnsRootStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
