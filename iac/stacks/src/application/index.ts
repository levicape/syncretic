import { Context } from "@levicape/fourtwo-pulumi";
import { Budget } from "@pulumi/aws/budgets/budget";
import { Group } from "@pulumi/aws/resourcegroups";
import { AppregistryApplication } from "@pulumi/aws/servicecatalog";
import { Topic } from "@pulumi/aws/sns/topic";
import { type Input, all } from "@pulumi/pulumi";
import type { z } from "zod";
import { FourtwoApplicationStackExportsZod } from "./exports";

export = async () => {
	const context = await Context.fromConfig({});
	const _ = (name: string) => `${context.prefix}-${name}`;

	const servicecatalog = (() => {
		return { application: new AppregistryApplication(_("servicecatalog"), {}) };
	})();

	const awsApplication = servicecatalog.application.applicationTag.apply(
		(tagMap) => {
			return tagMap["awsApplication"] ?? "";
		},
	);

	const resourcegroups = (() => {
		const group = (
			name: string,
			props: {
				resourceQuery: {
					type: string;
					query: Input<string>;
				};
			},
		) => {
			return {
				group: new Group(_(name), props),
			};
		};
		return {
			apps: group("resources", {
				resourceQuery: {
					type: "TAG_FILTERS_1_0",
					query: awsApplication.apply((app) =>
						JSON.stringify({
							ResourceTypeFilters: ["AWS::AllSupported"],
							TagFilters: [
								{
									Key: "awsApplication",
									Values: [app],
								},
							],
						}),
					),
				},
			}),
		};
	})();

	const sns = (() => {
		const topic = (name: string) => {
			return new Topic(_(`topic-${name}`), {
				tags: {
					awsApplication,
				},
			});
		};
		return {
			billing: topic("billing"),
			operations: topic("operations"),
		};
	})();

	(() => {
		const budget = (
			name: string,
			props: {
				limitAmount: string;
				timeUnit: "DAILY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
				threshold: number;
				notificationType: "ACTUAL" | "FORECASTED";
				subscriberSnsTopicArns: Array<string | Input<string>>;
			},
		) => {
			const {
				limitAmount,
				timeUnit,
				threshold,
				notificationType,
				subscriberSnsTopicArns,
			} = props;
			return new Budget(_(name), {
				budgetType: "COST",
				limitUnit: "USD",
				limitAmount,
				timeUnit,
				costFilters: [
					{
						name: "TagKeyValue",
						values: awsApplication.apply((app) => [`awsApplication$${app}`]),
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
				tags: {
					awsApplication,
				},
			});
		};

		return {
			daily_absolute: budget("daily-absolute", {
				limitAmount: "8",
				timeUnit: "DAILY",
				threshold: 3,
				notificationType: "ACTUAL",
				subscriberSnsTopicArns: [sns.billing.arn],
			}),
			daily_forecasted: budget("daily-forecasted", {
				limitAmount: "9",
				timeUnit: "DAILY",
				threshold: 2,
				notificationType: "FORECASTED",
				subscriberSnsTopicArns: [sns.billing.arn],
			}),
			monthly_absolute: budget("monthly-absolute", {
				limitAmount: "100",
				timeUnit: "MONTHLY",
				threshold: 10,
				notificationType: "ACTUAL",
				subscriberSnsTopicArns: [sns.billing.arn],
			}),
		};
	})();

	const servicecatalogOutput = all([
		servicecatalog.application.arn,
		servicecatalog.application.id,
		servicecatalog.application.name,
		awsApplication,
	]).apply(
		([applicationArn, applicationId, applicationName, applicationTag]) => {
			return {
				application: {
					arn: applicationArn,
					id: applicationId,
					name: applicationName,
					tag: applicationTag,
				},
			};
		},
	);

	const resourcegroupsOutput = all(
		Object.entries(resourcegroups).map(([name, group]) => {
			return all([
				name,
				group.group.arn,
				group.group.name,
				group.group.id,
				group.group.resourceQuery,
			]).apply(([_name, groupArn, groupName, groupId]) => {
				return {
					arn: groupArn,
					name: groupName,
					id: groupId,
				};
			});
		}),
	).apply((groups) => {
		return Object.fromEntries(
			Object.entries(groups).map(([name, group]) => {
				return [
					name,
					{
						group: {
							arn: group.arn,
							name: group.name,
							id: group.id,
						},
					},
				];
			}),
		);
	});

	const snsOutput = all(
		Object.entries(sns).map(([name, topic]) => {
			return all([name, topic.arn, topic.name, topic.id]).apply(
				([_name, topicArn, topicName, topicId]) => {
					return {
						arn: topicArn,
						name: topicName,
						id: topicId,
					};
				},
			);
		}),
	).apply((topics) => {
		return Object.fromEntries(
			Object.entries(topics).map(([name, topic]) => {
				return [
					name,
					{
						topic: {
							arn: topic.arn,
							name: topic.name,
							id: topic.id,
						},
					},
				];
			}),
		);
	});

	return all([servicecatalogOutput, resourcegroupsOutput, snsOutput]).apply(
		([servicecatalog, resourcegroups, snsTopics]) => {
			const exported = {
				fourtwo_application_servicecatalog: servicecatalog,
				fourtwo_application_resourcegroups: resourcegroups,
				fourtwo_application_sns: snsTopics,
			} satisfies z.infer<typeof FourtwoApplicationStackExportsZod>;

			const validate = FourtwoApplicationStackExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}
			return exported;
		},
	);
};
