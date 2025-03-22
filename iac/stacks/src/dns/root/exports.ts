import { z } from "zod";

export const FourtwoDnsRootStackrefRoot = "dns-root" as const;

export const FourtwoDnsRootStackExportsZod = z
	.object({
		fourtwo_dns_root_route53: z.object({
			zone: z
				.object({
					hostedZoneId: z.string(),
					hostedZoneName: z.string(),
					arn: z.string(),
					records: z.array(
						z.object({
							name: z.string(),
							type: z.string(),
							ttl: z.number().nullish(),
							zoneId: z.string(),
							records: z.array(z.string()).nullish(),
							fqdn: z.string(),
							healthCheckId: z.string().nullish(),
							id: z.string(),
						}),
					),
				})
				.nullish(),
		}),
		fourtwo_dns_root_acm: z.object({
			certificate: z
				.object({
					arn: z.string(),
					domainName: z.string(),
					status: z.string(),
					subjectAlternativeNames: z.array(z.string()).nullish(),
					keyAlgorithm: z.string(),
					notAfter: z.string(),
					notBefore: z.string(),
					renewalEligibility: z.string(),
				})
				.nullish(),
			renewalSummaries: z
				.array(
					z.object({
						renewalStatus: z.string(),
						renewalStatusReason: z.string().nullish(),
						updatedAt: z.string().nullish(),
					}),
				)
				.nullish(),
			validations: z
				.array(
					z.object({
						certificateArn: z.string(),
						validationRecordFqdns: z.array(z.string()).nullish(),
						id: z.string(),
					}),
				)
				.nullish(),
		}),
	})
	.passthrough();
