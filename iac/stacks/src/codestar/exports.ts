import { z } from "zod";

export const FourtwoCodestarStackExportsZod = z
	.object({
		fourtwo_codestar_ecr: z.object({
			repository: z.object({
				arn: z.string(),
				url: z.string(),
				name: z.string(),
			}),
		}),
		fourtwo_codestar_codedeploy: z.object({
			application: z.object({
				arn: z.string(),
				name: z.string(),
			}),
			deploymentConfig: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		fourtwo_codestar_appconfig: z.object({
			application: z.object({
				arn: z.string(),
				id: z.string(),
				name: z.string(),
			}),
		}),
		fourtwo_codestar_codeartifact: z.object({
			domain: z.object({
				arn: z.string(),
				name: z.string(),
				owner: z.string().nullish(),
				s3BucketArn: z.string().nullish(),
			}),
			repository: z.record(
				z.object({
					arn: z.string(),
					name: z.string(),
					description: z.string().nullish(),
					administratorAccount: z.string().nullish(),
					domainOwner: z.string().nullish(),
					externalConnections: z
						.object({
							externalConnectionName: z.string(),
						})
						.nullish(),
					upstreams: z
						.array(
							z.object({
								repositoryName: z.string(),
							}),
						)
						.nullish(),
				}),
			),
		}),
		fourtwo_codestar_ssm: z.object({
			levicape: z.object({
				npm: z.object({
					url: z.string(),
					host: z.string(),
					parameter: z.object({
						arn: z.string(),
						name: z.string(),
						type: z.string(),
						description: z.string().nullish(),
						keyId: z.string().nullish(),
						version: z.number().nullish(),
					}),
				}),
			}),
		}),
	})
	.passthrough();
