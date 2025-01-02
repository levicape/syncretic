import { CodePipelineConditionBuilder } from "../CodePipelineCondition.mjs";
import type { CodePipelineRuleBuilder } from "../CodePipelineRule.mjs";

export type CodePipelineConditionXProps = {
	result?: "ROLLBACK" | "FAIL" | "RETRY" | "SKIP";
	rules?: CodePipelineRuleBuilder[];
};

export function CodePipelineConditionX(props: CodePipelineConditionXProps) {
	const builder: CodePipelineConditionBuilder =
		new CodePipelineConditionBuilder();
	if (props.result) {
		builder.setResult(props.result);
	}
	if (props.rules) {
		builder.setRules(props.rules);
	}
	return builder;
}
