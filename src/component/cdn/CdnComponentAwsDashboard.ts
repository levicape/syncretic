import type { Distribution } from "@pulumi/aws/cloudfront/index.js";
import type {
	DashboardArgs,
	MetricAlarm,
} from "@pulumi/aws/cloudwatch/index.js";
import { interpolate } from "@pulumi/pulumi/index.js";
import type { Context } from "../../context/Context.js";

export const CdnComponentAwsDashboard = (
	{ prefix, environment }: Context,
	cache: Distribution,
	alarms: MetricAlarm[],
) =>
	({
		dashboardName: interpolate`CDN_${prefix}_${cache.hostedZoneId}`,
		dashboardBody: JSON.stringify({
			widgets: [
				{
					type: "metric",
					x: 0,
					y: 0,
					width: 6,
					height: 6,
					properties: {
						metrics: [
							["AWS/CloudFront", "CacheHitRate", "DistributionId", cache.id],
							["AWS/CloudFront", "Requests", "DistributionId", cache.id],
							["AWS/CloudFront", "4xxErrorRate", "DistributionId", cache.id],
						],
						period: 300,
						stat: "Average",
						region: environment.aws?.region,
						title: "CDN Metrics",
					},
				},
				{
					type: "alarm",
					x: 6,
					y: 0,
					width: 6,
					height: 6,
					properties: {
						alarms,
						region: environment.aws?.region,
						title: "CDN Alarms",
					},
				},
			],
		}),
	}) satisfies DashboardArgs;
