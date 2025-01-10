import { Budget } from "@pulumi/aws/budgets/index.js";
import type { ComponentResourceOptions } from "@pulumi/pulumi/index.js";
import { Context } from "../../context/Context.js";

type TimeUnit = "MONTHLY" | "DAILY";
type NotificationType = "ACTUAL" | "FORECASTED";
type BudgetFactoryProps<
	TU extends TimeUnit = TimeUnit extends "DAILY" ? never : TimeUnit,
> = {
	timeUnit: TU;
	limitAmount: `${number}`;
	threshold: number;
	notificationType: TU extends "DAILY" ? never : NotificationType;
};
export class BudgetFactory {
	static of = (
		name: string,
		context: Context,
		{ timeUnit, limitAmount, threshold, notificationType }: BudgetFactoryProps,
		{ parent }: ComponentResourceOptions,
	): Budget => {
		const { prefix } = context;
		return new Budget(
			`${name}-Budget`,
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
						subscriberEmailAddresses: [
							"pedro+goland@evermagica.com",
							"omegatitan+goland@gmail.com",
						],
					},
					{
						comparisonOperator: "GREATER_THAN",
						threshold: Math.max(threshold, 1),
						notificationType,
						thresholdType: "ABSOLUTE_VALUE",
						subscriberEmailAddresses: [
							"pedro+goland@evermagica.com",
							"omegatitan+goland@gmail.com",
						],
					},
				],
			},
			{ parent },
		);
	};

	private _uid = Date.now().toString();
}
