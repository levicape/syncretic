import VError from "verror";
import type {
	CodePipelineAction,
	CodePipelineActionBuilder,
	CodePipelineParallelActionBuilder,
} from "./CodePipelineAction.mjs";
import type {
	CodePipelineBlocker,
	CodePipelineBlockerBuilder,
} from "./CodePipelineBlocker.mjs";
import type {
	CodePipelineCondition,
	CodePipelineConditionBuilder,
} from "./CodePipelineCondition.mjs";
import type { CodePipelineRuleBuilder } from "./CodePipelineRule.mjs";

export type CodePipelineStage = {
	name: string; // Builder validation: Minimum 1 character, Maximum 100 characters. Regex: ^[A-Za-z0-9_-]+$
	beforeEntry?: {
		conditions: CodePipelineCondition[]; // Builder validation: Fixed number of 1 if exists. Not required.
	};
	blockers?: CodePipelineBlocker[] & never; // Reserved for future use
	onSuccess?: {
		conditions: CodePipelineCondition[]; // Builder validation: Fixed number of 1. Not required.
	};
	onFailure?: {
		result: "ROLLBACK" | "FAIL" | "RETRY" | "SKIP";
		conditions?: CodePipelineCondition[]; // Builder validation: Fixed number of 1 if exists. Not required.
		retryConfiguration?: {
			retryMode?: "FAILED_ACTIONS" | "ALL_ACTIONS";
		};
	};
	actions: CodePipelineAction[];
};

export const CodePipelineStageNameRegex = /^[A-Za-z0-9_-]+$/;

export class CodePipelineStageBuilder {
	private name: string;
	private actions: (
		| CodePipelineActionBuilder
		| CodePipelineParallelActionBuilder
	)[] = [];
	private conditions: CodePipelineConditionBuilder[] = [];
	private blockers: CodePipelineBlockerBuilder[] = [];
	private rules: CodePipelineRuleBuilder[] = [];
	private retryConfiguration: { retryMode: "FAILED_ACTIONS" | "ALL_ACTIONS" } =
		{ retryMode: "FAILED_ACTIONS" };
	private onFailure: {
		result: "ROLLBACK" | "FAIL" | "RETRY" | "SKIP";
		conditions?: CodePipelineConditionBuilder[];
		retryConfiguration?: { retryMode?: "FAILED_ACTIONS" | "ALL_ACTIONS" };
	} = {
		result: "ROLLBACK",
		conditions: [],
		retryConfiguration: { retryMode: "FAILED_ACTIONS" },
	};
	private onSuccess: {
		conditions: CodePipelineConditionBuilder[];
	} = {
		conditions: [],
	};

	constructor(name: string) {
		this.name = name;
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	addAction(
		action: CodePipelineActionBuilder | CodePipelineParallelActionBuilder,
	): this {
		this.actions.push(action);
		return this;
	}

	setActions(
		actions: (CodePipelineActionBuilder | CodePipelineParallelActionBuilder)[],
	): this {
		this.actions = actions;
		return this;
	}

	getActions(): CodePipelineActionBuilder[] {
		return this.actions as CodePipelineActionBuilder[];
	}

	addCondition(condition: CodePipelineConditionBuilder): this {
		this.conditions.push(condition);
		return this;
	}

	setConditions(conditions: CodePipelineConditionBuilder[]): this {
		this.conditions = conditions;
		return this;
	}

	addBlocker(blocker: CodePipelineBlockerBuilder): this {
		console.warn({
			message: "Blockers are reserved for future use",
		});
		this.blockers.push(blocker);
		return this;
	}

	setBlockers(blockers: CodePipelineBlockerBuilder[]): this {
		console.warn({
			message: "Blockers are reserved for future use",
		});
		this.blockers = blockers;
		return this;
	}

	addRule(rule: CodePipelineRuleBuilder): this {
		this.rules.push(rule);
		return this;
	}

	setRules(rules: CodePipelineRuleBuilder[]): this {
		this.rules = rules;
		return this;
	}

	setRetryConfiguration(retryConfiguration: {
		retryMode: "FAILED_ACTIONS" | "ALL_ACTIONS";
	}): this {
		this.retryConfiguration = retryConfiguration;
		return this;
	}

	setOnFailure({
		result,
		conditions,
		retryConfiguration,
	}: {
		result: "ROLLBACK" | "FAIL" | "RETRY" | "SKIP";
		conditions?: CodePipelineConditionBuilder[] | undefined;
		retryConfiguration?: { retryMode?: "FAILED_ACTIONS" | "ALL_ACTIONS" };
	}): this {
		this.onFailure = {
			result,
			conditions,
			retryConfiguration,
		};
		return this;
	}

	setOnSuccess({
		conditions,
	}: {
		conditions: CodePipelineConditionBuilder[];
	}): this {
		this.onSuccess = {
			conditions,
		};
		return this;
	}

	build(): CodePipelineStage {
		if (this.name.length < 1 || this.name.length > 100) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_STAGE",
					info: { name: this.name },
				},
				"Stage name must be between 1 and 100 characters",
			);
		}

		if (!CodePipelineStageNameRegex.test(this.name)) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_STAGE",
					info: { name: this.name },
				},
				"Stage name must match /^[A-Za-z0-9_-]+$/",
			);
		}

		if (this.actions.length === 0) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_STAGE",
					info: { actions: this.actions },
				},
				"Stage must have at least 1 action",
			);
		}

		if (this.conditions.length > 1) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_STAGE",
					info: { conditions: this.conditions },
				},
				"Stage must have at most 1 condition",
			);
		}

		if (this.onSuccess.conditions.length > 1) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_STAGE",
					info: { onSuccess: this.onSuccess },
				},
				"OnSuccess must have exactly 1 condition",
			);
		}

		let failureConditions = this.onFailure.conditions ?? [];
		if (failureConditions.length > 1) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_STAGE",
					info: { onFailure: this.onFailure },
				},
				"OnFailure must have at most 1 condition",
			);
		}

		const beforeEntry =
			this.conditions.length > 0
				? {
						beforeEntry: {
							conditions: this.conditions.map((condition) => condition.build()),
						},
					}
				: {};
		const onSuccess =
			this.onSuccess.conditions.length > 0
				? {
						onSuccess: {
							conditions: this.onSuccess.conditions.map((condition) =>
								condition.build(),
							),
						},
					}
				: {};
		const onFailure =
			failureConditions.length > 0
				? {
						onFailure: {
							result: this.onFailure.result,
							conditions: failureConditions.map((condition) =>
								condition.build(),
							),
							retryConfiguration: this.retryConfiguration,
						},
					}
				: {};

		return {
			name: this.name,
			actions: this.actions.flatMap((action) => action.build()),
			...beforeEntry,
			// blockers: this.blockers.map((blocker) => blocker.build()),
			...onSuccess,
			...onFailure,
		};
	}
}
