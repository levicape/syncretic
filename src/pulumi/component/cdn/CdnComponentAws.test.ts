import { ok } from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";
import * as allAws from "@pulumi/aws/index.js";
import type { BucketV2 } from "@pulumi/aws/s3/index.js";
import { Output } from "@pulumi/pulumi/index.js";
import { expect } from "expect";
import type { WebsiteManifest } from "../website/WebsiteManifest.js";
import {
	CdnComponentAws,
	type CdnComponentAwsProps,
} from "./CdnComponentAws.js";

const actualAws = allAws;

mock.module("@pulumi/aws/index.js", {
	namedExports: {
		lambda: {
			...(actualAws as unknown as { lambda: {} }).lambda,
			Permission: mock.fn(() => ({})),
		},
		cloudfront: {
			Distribution: mock.fn(() => ({
				id: "fake-distribution-id",
				domainName: "fake-domain-name",
				arn: "fake-distribution-arn",
			})),
			Function: mock.fn(() => ({
				arn: "fake-function-arn",
			})),
			OriginAccessIdentity: mock.fn(() => ({
				iamArn: "fake-iam-arn",
				cloudfrontAccessIdentityPath: "fake-cloudfront-access-identity-path",
			})),
		},
		s3: {
			BucketV2: mock.fn(() => ({
				bucket: "fake-bucket",
				bucketDomainName: "fake-bucket-domain",
			})),
			BucketAclV2: mock.fn(() => ({})),
			BucketOwnershipControls: mock.fn(() => ({})),
			BucketLifecycleConfigurationV2: mock.fn(() => ({})),
			BucketObject: mock.fn(() => ({})),
			BucketPolicy: mock.fn(() => ({})),
		},
		iam: {
			Role: mock.fn(() => ({
				arn: "fake-role-arn",
			})),
		},
	},
});

describe("CdnComponentAws", () => {
	let props: unknown;

	beforeEach(() => {
		props = {
			context: {
				frontend: {
					dns: {
						hostnames: ["fake-hostname"],
					},
				},
				environment: {
					isProd: true,
					features: "aws",
				},
			},
			bucketDomainName: "fake-bucket-domain",
			compute: {
				aws: {
					http: {
						url: {
							functionUrl: "https://fake-compute-url",
						},
					},
				},
			},
			assets: {
				rootOnly: false,
				build: {
					wwwroot: "fake-wwwroot",
					indexHtmlPath: "fake-index-html-path",
					errorHtmlPath: "fake-error-html-path",
				},
				aws: {
					bucket: {
						arn: "fake-bucket-arn",
						bucketDomainName: "fake-bucket-domain",
					} as unknown as BucketV2,
					website: {
						websiteEndpoint: "fake-website-endpoint",
					} as unknown,
					manifest: {
						content: Output.create({
							WebsiteComponent: {
								manifest: {
									ok: true,
									routes: {
										"/": {},
									},
									version: {
										sequence: "fake-sequence",
										build: "fake-build",
										stage: "fake-stage",
									},
								},
							},
						}) as unknown as Output<{ WebsiteComponent: WebsiteManifest }>,
					} as NonNullable<CdnComponentAwsProps["assets"]>["aws"]["manifest"],
				} as NonNullable<CdnComponentAwsProps["assets"]>["aws"],
			} as CdnComponentAwsProps["assets"],
			routes: {},
		};
	});

	it("should set origins correctly when compute component is available", async () => {
		const cdnComponent = new CdnComponentAws(
			"test-cdn",
			props as CdnComponentAwsProps,
		);

		await new Promise((resolve) => {
			cdnComponent.aws.cache.orderedCacheBehaviors.apply((origins) => {
				expect(origins).toMatchObject([
					{
						allowedMethods: [
							"HEAD",
							"DELETE",
							"POST",
							"GET",
							"OPTIONS",
							"PUT",
							"PATCH",
						],
						cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
						cachedMethods: ["HEAD", "GET"],
						compress: true,
						originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
						pathPattern: "/assets/*",
						targetOriginId: "default__origin__assets",
						viewerProtocolPolicy: "redirect-to-https",
					},
					{
						allowedMethods: [
							"HEAD",
							"DELETE",
							"POST",
							"GET",
							"OPTIONS",
							"PUT",
							"PATCH",
						],
						cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
						cachedMethods: ["HEAD", "GET"],
						compress: true,
						originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
						pathPattern: "/*",
						targetOriginId: "default__origin__compute",
						viewerProtocolPolicy: "redirect-to-https",
					},
				]);
			});
		});
	});
	it("should set origins correctly when compute component is not available", async () => {
		(props as { compute: undefined }).compute = undefined;

		const cdnComponent = new CdnComponentAws(
			"test-cdn",
			props as CdnComponentAwsProps,
		);

		await new Promise((resolve) => {
			cdnComponent.aws.cache.orderedCacheBehaviors.apply((origins) => {
				expect(origins).toMatchObject([
					{
						allowedMethods: [
							"HEAD",
							"DELETE",
							"POST",
							"GET",
							"OPTIONS",
							"PUT",
							"PATCH",
						],
						cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
						cachedMethods: ["HEAD", "GET"],
						compress: true,
						originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
						pathPattern: "/*",
						targetOriginId: "default__origin__assets",
						viewerProtocolPolicy: "redirect-to-https",
					},
				]);
			});
		});
		ok((1 as unknown as boolean) === true);
	});
});
