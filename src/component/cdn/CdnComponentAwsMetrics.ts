import type { Distribution } from "@pulumi/aws/cloudfront/distribution.js";

export const cacheHitRateMetric = (cache: Distribution) => ({
	namespace: "AWS/CloudFront",
	metricName: "CacheHitRate",
	dimensions: {
		DistributionId: cache.id,
	},
	statistic: "Average",
});

export const requestCountMetric = (cache: Distribution) => ({
	namespace: "AWS/CloudFront",
	metricName: "Requests",
	dimensions: {
		DistributionId: cache.id,
	},
	statistic: "Sum",
});

export const errorRateMetric = (cache: Distribution) => ({
	namespace: "AWS/CloudFront",
	metricName: "4xxErrorRate",
	dimensions: {
		DistributionId: cache.id,
	},
	statistic: "Average",
});
