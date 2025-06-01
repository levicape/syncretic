import { Certificate } from "@pulumi/aws/acm";
import { CertificateValidation } from "@pulumi/aws/acm/certificateValidation";
import { Provider } from "@pulumi/aws/provider";
import { Zone } from "@pulumi/aws/route53";
import { Record } from "@pulumi/aws/route53/record";
import {
	BucketLifecycleConfigurationV2,
	BucketOwnershipControls,
	BucketPublicAccessBlock,
	BucketServerSideEncryptionConfigurationV2,
	BucketVersioningV2,
	BucketWebsiteConfigurationV2,
	PublicReadAcl
} from "@pulumi/aws/s3";
import { Bucket } from "@pulumi/aws/s3/bucket";
import * as pulumi from "@pulumi/pulumi";
import { error } from "@pulumi/pulumi/log";
import { all, interpolate } from "@pulumi/pulumi/output";
import { RandomId } from "@pulumi/random";
import { S3BucketFolder } from "@pulumi/synced-folder";
import { statfs } from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";

const FOLDER_PATH = resolve(join(
	cwd(), "..", "..", ".vitepress", "dist")
);

const _ = (name: string) => `${pulumi.getStack()}-${name}`;

const isProd = (pulumi.getStack() ?? "")?.includes("prod");

const getStack = () => {
	const stack = process.env.PULUMI_STACK;

	if (!stack) {
		error(`No stack found in the environment. Please check your configuration.`);
	}

	return stack;
};

const domainName = (() => {
	const hostname = "beta.docs.fourtwo.levicape.cloud";
	return hostname?.replace(/[^a-zA-Z0-9-.]/g, "-");
})();

if (!domainName) {
	throw new Error(
	`No domain name found in the context. Please check your configuration.`,
	);

}

const hostedZone = new Zone(_("hosted-zone"), {
	name: domainName,
	forceDestroy: true,
	comment: `Root zone for  application ()`,
	tags: {
		Name: _("hosted-zone"),
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

const s3 = (() => {
	const bucket = (
		name: string,
		props?: {
			daysToRetain?: number;
			www?: boolean;
		},
	) => {
		const { daysToRetain, www } = {
			daysToRetain:
				props?.www === true ? undefined : getStack() ? 30 : 8,
			www: false,
			...props,
		};

		const randomid = new RandomId(_(`${name}-id`), {
			byteLength: 4,
		});

		const urlsafe = _(name).replace(/[^a-zA-Z0-9]/g, "-");
		const bucket = new Bucket(
			_(name),
			{
				bucket: interpolate`${urlsafe}-${randomid.hex}`,
				acl: "private",
				forceDestroy: true,
				tags: {
					Name: _(name),
					Key: name,
				},
			},
			{
				ignoreChanges: [
					"acl",
					"lifecycleRules",
					"loggings",
					"policy",
					"serverSideEncryptionConfiguration",
					"versioning",
					"website",
					"websiteDomain",
					"websiteEndpoint",
				],
			},
		);

		new BucketServerSideEncryptionConfigurationV2(
			_(`${name}-encryption`),
			{
				bucket: bucket.bucket,
				rules: [
					{
						applyServerSideEncryptionByDefault: {
							sseAlgorithm: "AES256",
						},
					},
				],
			},
			{
				deletedWith: bucket,
			},
		);

		new BucketVersioningV2(
			_(`${name}-versioning`),
			{
				bucket: bucket.bucket,
				versioningConfiguration: {
					status: "Enabled",
				},
			},
			{
				deletedWith: bucket,
			},
		);

		let website: BucketWebsiteConfigurationV2 | undefined;
		if (www === true) {
			const bucketName = bucket.bucket;
			const publicAccessBlock = new BucketPublicAccessBlock(
				_(`${name}-public-access`),
				{
					bucket: bucketName,
					blockPublicAcls: false,
					blockPublicPolicy: false,
					ignorePublicAcls: false,
					restrictPublicBuckets: false,
				},
				{
					deletedWith: bucket,
				},
			);

			const ownershipControls = new BucketOwnershipControls(
				_(`${name}-ownership-controls`),
				{
					bucket: bucketName,
					rule: {
						objectOwnership: "ObjectWriter",
					},
				},
				{
					dependsOn: [bucket, publicAccessBlock],
					deletedWith: bucket,
				},
			);

			website = new BucketWebsiteConfigurationV2(
				_(`${name}-website`),
				{
					bucket: bucketName,
					indexDocument: {
						suffix: "index.html",
					},
					errorDocument: {
						key: "error.html",
					},
				},
				{
					dependsOn: [bucket, publicAccessBlock, ownershipControls],
					deletedWith: bucket,
				},
			);
		} else {
			new BucketPublicAccessBlock(
				_(`${name}-public-access`),
				{
					bucket: bucket.bucket,
					blockPublicAcls: true,
					blockPublicPolicy: true,
					ignorePublicAcls: true,
					restrictPublicBuckets: true,
				},
				{
					deletedWith: bucket,
				},
			);
		}

		if (daysToRetain && daysToRetain > 0) {
			new BucketLifecycleConfigurationV2(
				_(`${name}-lifecycle`),
				{
					bucket: bucket.bucket,
					rules: [
						{
							status: "Enabled",
							id: "DeleteMarkers",
							expiration: {
								expiredObjectDeleteMarker: true,
							},
						},
						{
							status: "Enabled",
							id: "IncompleteMultipartUploads",
							abortIncompleteMultipartUpload: {
								daysAfterInitiation: isProd ? 3 : 7,
							},
						},
						{
							status: "Enabled",
							id: "NonCurrentVersions",
							noncurrentVersionExpiration: {
								noncurrentDays: isProd ? 13 : 6,
							},
							filter: {
								objectSizeGreaterThan: 1,
							},
						},
						{
							status: "Enabled",
							id: "ExpireObjects",
							expiration: {
								days: isProd ? 20 : 10,
							},
							filter: {
								objectSizeGreaterThan: 1,
							},
						},
					],
				},
				{
					deletedWith: bucket,
				},
			);
		}

		return {
			bucket,
			website,
		};
	};

	return {
		staticwww: bucket("staticwww", { www: true }),
	};
})();

statfs(FOLDER_PATH, (err, stats) => {
	if (err) {
		error(`Error accessing folder ${FOLDER_PATH}: ${err.message}`);
	} else {
		if (stats.blocks === 0) {
			error(`Folder ${FOLDER_PATH} is empty or does not exist.`);	
		}
	}
});

const website = new S3BucketFolder("synced-folder", 
	{
    	path: FOLDER_PATH,
    	bucketName: s3.staticwww.bucket.bucket,
    	acl: PublicReadAcl,
	}
);

export const stacks = {
	domainName,
	hostedZone,
	route53Output,
	acmOutput,
	s3,
	provider: usEast1Provider,
	website,
};