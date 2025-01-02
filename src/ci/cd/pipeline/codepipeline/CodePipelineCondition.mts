import type {
	CodePipelineRule,
	CodePipelineRuleBuilder,
} from "./CodePipelineRule.mjs";

export type CodePipelineCondition = {
	result?: "ROLLBACK" | "FAIL" | "RETRY" | "SKIP";
	rules?: CodePipelineRule[]; // Builder validation: Minumum of 1. Maximum of 5
};

export class CodePipelineConditionBuilder {
	private result?: CodePipelineCondition["result"];
	private rules: CodePipelineRuleBuilder[] = [];

	setResult(result: CodePipelineCondition["result"]): this {
		this.result = result;
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

	build(): CodePipelineCondition {
		if (this.rules.length === 0) {
			throw new Error("At least one rule is required");
		}

		if (this.rules.length > 5) {
			throw new Error("Maximum of 5 rules allowed");
		}

		return {
			result: this.result,
			rules: this.rules.map((rule) => rule.build()),
		};
	}
}
