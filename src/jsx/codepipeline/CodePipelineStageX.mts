import type { CodePipelineActionBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineAction.mjs";
import type { CodePipelineConditionBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineCondition.mjs";
import { CodePipelineStageBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineStage.mjs";

export type CodePipelineStageXProps = {
	name: string;
	beforeEntry?: {
		conditions: CodePipelineConditionBuilder[];
	};
	onSuccess?: {
		conditions: CodePipelineConditionBuilder[];
	};
	onFailure?: {
		result: "ROLLBACK" | "FAIL" | "RETRY" | "SKIP";
		conditions?: CodePipelineConditionBuilder[];
		retryConfiguration?: {
			retryMode?: "FAILED_ACTIONS" | "ALL_ACTIONS";
		};
	};
	actions?: CodePipelineActionBuilder[];
};

export function CodePipelineStageX(props: CodePipelineStageXProps) {
	const builder: CodePipelineStageBuilder = new CodePipelineStageBuilder(
		props.name,
	);

	if (props.beforeEntry) {
		if (Array.isArray(props.beforeEntry.conditions)) {
			builder.setConditions(props.beforeEntry.conditions);
		} else {
			builder.addCondition(props.beforeEntry.conditions);
		}
	}

	if (props.onSuccess) {
		builder.setOnSuccess(props.onSuccess);
	}

	if (props.onFailure) {
		builder.setOnFailure(props.onFailure);
	}

	if (props.actions) {
		if (Array.isArray(props.actions)) {
			builder.setActions(props.actions);
		} else {
			builder.addAction(props.actions);
		}
	}

	return builder;
}
