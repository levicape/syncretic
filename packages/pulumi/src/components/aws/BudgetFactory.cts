import { Budget } from "@pulumi/aws/budgets/index.js";
import type { ComponentResourceOptions } from "@pulumi/pulumi/index.js";
import { Context } from "../../context/Context.cjs";

type TimeUnit = "MONTHLY" | "DAILY";
type NotificationType = "ACTUAL" | "FORECASTED";
type BudgetFactoryProps<
	TU extends TimeUnit = TimeUnit extends "DAILY" ? never : TimeUnit,
> = {
	subscriberSnsTopicArns: string[];
	timeUnit: TU;
	limitAmount: `${number}`;
	threshold: number;
	notificationType: TU extends "DAILY" ? never : NotificationType;
};
export class BudgetFactory {
	static of = (
		name: string,
		context: Context,
		{
			timeUnit,
			limitAmount,
			threshold,
			notificationType,
			subscriberSnsTopicArns,
		}: BudgetFactoryProps,
		componentOpts?: ComponentResourceOptions,
	): Budget => {
		const { prefix } = context;
		const { parent } = componentOpts ?? {};
		return new Budget(
			name,
			{
				budgetType: "COST",
				limitUnit: "USD",
				limitAmount,
				timeUnit,
				costFilters: [
					{
						name: "TagKeyValue",
						values: [`${Context._PREFIX_TAG}$${prefix}`],
					},
				],
				notifications: [
					{
						comparisonOperator: "GREATER_THAN",
						threshold: Math.max(threshold - 2, 1),
						thresholdType: "ABSOLUTE_VALUE",
						notificationType,
						subscriberSnsTopicArns,
					},
					{
						comparisonOperator: "GREATER_THAN",
						threshold: Math.max(threshold, 1),
						notificationType,
						thresholdType: "ABSOLUTE_VALUE",
						subscriberSnsTopicArns,
					},
				],
			},
			{ parent },
		);
	};
}
