import { z } from "zod";

export const FourtwoPanelWWWRootSubdomain = "panel";

/**
 * 	@see Cloudfront distributions are not provisioned immediately.
 *  An undefined distribution means that it is not yet available,
 *  but subsequent push will populate the values.
 *  This is a workaround to allow the pipeline to be created
 * 	without waiting for the distribution to be available
 */
export const FourtwoPanelWWWRootExportsZod = z
	.object({
		fourtwo_panel_wwwroot_cloudfront: z
			.object({
				distribution: z.object({
					arn: z.string(),
					id: z.string(),
					domainName: z.string(),
					status: z.string(),
					aliases: z.array(z.string()).nullish(),
					originAccessIdentity: z.string().nullish(),
					etag: z.string(),
					lastModifiedTime: z.string(),
					enabled: z.boolean().nullish(),
					isIpv6Enabled: z.boolean().nullish(),
					httpVersion: z.string().nullish(),
					priceClass: z.string().nullish(),
					webAclId: z.string().nullish(),
					origins: z.array(
						z
							.object({
								originId: z.string(),
								domainName: z.string(),
								s3OriginConfig: z
									.object({
										originAccessIdentity: z.string().nullish(),
									})
									.nullish(),
								customOriginConfig: z
									.object({
										httpPort: z.number().nullish(),
										httpsPort: z.number().nullish(),
										originProtocolPolicy: z.string().nullish(),
										originSslProtocols: z.array(z.string()).nullish(),
										originReadTimeout: z.number().nullish(),
										originKeepaliveTimeout: z.number().nullish(),
									})
									.nullish(),
								connectionAttempts: z.number().nullish(),
								connectionTimeout: z.number().nullish(),
								originPath: z.string().nullish(),
								originShield: z
									.object({
										enabled: z.boolean(),
										originShieldRegion: z.string().nullish(),
									})
									.nullish(),
							})
							.passthrough(),
					),
					defaultCacheBehavior: z.object({
						cachePolicyId: z.string().nullish(),
						targetOriginId: z.string(),
						functionAssociations: z
							.array(
								z.object({
									functionArn: z.string(),
									eventType: z.string(),
								}),
							)
							.nullish(),
						viewerProtocolPolicy: z.string().nullish(),
						allowedMethods: z.array(z.string()),
						cachedMethods: z.array(z.string()),
						compress: z.boolean().nullish(),
						originRequestPolicyId: z
							.union([z.string(), z.null(), z.undefined()])
							.nullish(),
						smoothStreaming: z.boolean().nullish(),
						fieldLevelEncryptionId: z.string().nullish(),
						trustedSigners: z.array(z.string()).nullish(),
						trustedKeyGroups: z.array(z.string()).nullish(),
						lambdaFunctionAssociations: z
							.array(
								z.object({
									eventType: z.string(),
									lambdaArn: z.string(),
									includeBody: z.boolean().nullish(),
								}),
							)
							.nullish(),
					}),
					orderedCacheBehaviors: z
						.array(
							z
								.object({
									pathPattern: z.string(),
									targetOriginId: z.string(),
									cachePolicyId: z.string().nullish(),
									originRequestPolicyId: z.string().nullish(),
									viewerProtocolPolicy: z.string().nullish(),
									allowedMethods: z.array(z.string()),
									functionAssociations: z
										.array(
											z.object({
												functionArn: z.string(),
												eventType: z.string(),
											}),
										)
										.nullish(),
									cachedMethods: z.array(z.string()),
									compress: z.boolean().nullish(),
									smoothStreaming: z.boolean().nullish(),
									fieldLevelEncryptionId: z.string().nullish(),
									trustedSigners: z.array(z.string()).nullish(),
									trustedKeyGroups: z.array(z.string()).nullish(),
									lambdaFunctionAssociations: z
										.array(
											z.object({
												eventType: z.string(),
												lambdaArn: z.string(),
												includeBody: z.boolean().nullish(),
											}),
										)
										.nullish(),
								})
								.passthrough(),
						)
						.nullish(),
					customErrorResponses: z
						.array(
							z.object({
								errorCode: z.number(),
								responsePagePath: z.string().nullish(),
								responseCode: z.number().nullish(),
								errorCachingMinTtl: z.number().nullish(),
							}),
						)
						.nullish(),
					restrictions: z
						.object({
							geoRestriction: z.object({
								restrictionType: z.string(),
								locations: z.array(z.string()).nullish(),
							}),
						})
						.nullish(),
					viewerCertificate: z
						.object({
							acmCertificateArn: z.string().nullish(),
							cloudfrontDefaultCertificate: z.boolean().nullish(),
							iamCertificateId: z.string().nullish(),
							minimumProtocolVersion: z.string().nullish(),
							sslSupportMethod: z.string().nullish(),
						})
						.nullish(),
					loggingConfig: z
						.object({
							bucket: z.string(),
							includeCookies: z.boolean().nullish(),
							prefix: z.string().nullish(),
						})
						.nullish(),
				}),
			})
			.passthrough()
			.nullish(),
		fourtwo_panel_wwwroot_codebuild: z.object({
			invalidate: z.object({
				buildspec: z.object({
					bucket: z.string(),
					key: z.string(),
				}),
				project: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
		}),
		fourtwo_panel_wwwroot_s3: z.object({
			artifacts: z.object({
				bucket: z.string(),
				region: z.string(),
			}),
			logs: z.object({
				bucket: z.string(),
				region: z.string(),
			}),
		}),
	})
	.passthrough();
