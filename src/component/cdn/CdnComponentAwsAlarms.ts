import type { Distribution } from "@pulumi/aws/cloudfront/distribution.js";
import type { MetricAlarmArgs } from "@pulumi/aws/cloudwatch/index.js";
import {
	cacheHitRateMetric,
	errorRateMetric,
	requestCountMetric,
} from "./CdnComponentAwsMetrics.js";

// Define alarms
export const cacheHitRateAlarm = (cache: Distribution) =>
	({
		metricName: cacheHitRateMetric(cache).metricName,
		comparisonOperator: "LessThanThreshold",
		threshold: 80, // Adjust threshold as needed
		evaluationPeriods: 1,
		alarmDescription: "Alarm if cache hit rate falls below 80%",
		// alarmActions: ['<SNS_TOPIC_ARN>'], // Replace with your SNS topic ARN
	}) satisfies MetricAlarmArgs;

export const requestCountAlarm = (cache: Distribution) => ({
	metricName: requestCountMetric(cache).metricName,
	comparisonOperator: "GreaterThanThreshold",
	threshold: 10000, // Adjust threshold as needed
	evaluationPeriods: 1,
	alarmDescription: "Alarm if request count exceeds 10,000",
	// alarmActions: ['<SNS_TOPIC_ARN>'], // Replace with your SNS topic ARN
});

export const errorRateAlarm = (cache: Distribution) => ({
	metricName: errorRateMetric(cache).metricName,
	comparisonOperator: "GreaterThanThreshold",
	threshold: 5, // Adjust threshold as needed
	evaluationPeriods: 1,
	alarmDescription: "Alarm if error rate exceeds 5%",
	// alarmActions: ['<SNS_TOPIC_ARN>'], // Replace with your SNS topic ARN
});
