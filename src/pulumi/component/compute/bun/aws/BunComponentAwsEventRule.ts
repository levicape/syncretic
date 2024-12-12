import { EventRule } from "@pulumi/aws/cloudwatch/eventRule.js";
import { EventTarget } from "@pulumi/aws/cloudwatch/eventTarget.js";
import type { Function as LambdaFunction } from "@pulumi/aws/lambda/index.js";
import { Permission } from "@pulumi/aws/lambda/permission.js";
import type { ComponentResource } from "@pulumi/pulumi/index.js";

type CronTime = `${number | "*"}`;
type CronExpression =
	`cron(${`${CronTime} ${CronTime} ${CronTime} ${CronTime}`})`;
type RateExpression = `rate(${`${number} ${"minutes"}`})`;
export type BunComponentAwsEventRuleScheduleExpression =
	| CronExpression
	| RateExpression;
export type BunComponentAwsEventRuleProps = {
	name: string;
	lambda: LambdaFunction;
	scheduleExpression: BunComponentAwsEventRuleScheduleExpression;
	parent: ComponentResource;
};

export type BunComponentAwsEventRuleState = {
	rule: EventRule;
	target: EventTarget;
};

export const BunComponentAwsEventRule = ({
	name,
	lambda,
	scheduleExpression,
	parent,
}: BunComponentAwsEventRuleProps): BunComponentAwsEventRuleState => {
	const rule = new EventRule(
		`${name}-Bun--Schedule`,
		{
			name: `${name}-Bun--Schedule`,
			description: `Scheduled execution for ${name}`,
			scheduleExpression,
		},
		{
			parent,
		},
	);

	const target = new EventTarget(
		`${name}-Bun--Target`,
		{
			targetId: `${name}-Bun--Target`,
			rule: rule.name,
			arn: lambda.arn,
		},
		{
			parent,
		},
	);

	new Permission(`${name}-Bun--EventBridge-Policy`, {
		statementId: "AllowExecutionFromCloudWatch",
		action: "lambda:InvokeFunction",
		function: lambda.name,
		principal: "events.amazonaws.com",
	});

	return { rule, target };
};
