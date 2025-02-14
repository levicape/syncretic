import type { CodePipelineArtifactStoreBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineArtifactStore.mjs";
import { CodePipelineDefinitionBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineDefinition.mjs";
import type { CodePipelineStageBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineStage.mjs";
import type { CodePipelineTriggerBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineTrigger.mjs";
import type { CodePipelineVariableBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineVariable.mjs";

export type CodePipelineDefinitionXProps = {
	name: string;
	executionMode: "PARALLEL" | "SUPERSEDED" | "QUEUED";
	roleArn: string;
	triggers?: CodePipelineTriggerBuilder[];
	variables?: CodePipelineVariableBuilder[];
	stages: CodePipelineStageBuilder[];
} & (
	| {
			artifactStore: CodePipelineArtifactStoreBuilder;
			artifactStores?: never;
	  }
	| {
			artifactStore?: never;
			artifactStores: Record<string, CodePipelineArtifactStoreBuilder>;
	  }
);

export function CodePipelineDefinitionX(props: CodePipelineDefinitionXProps) {
	const builder = new CodePipelineDefinitionBuilder(props.name);

	builder.setExecutionMode(props.executionMode);
	if (props.roleArn) {
		builder.setRoleArn(props.roleArn);
	}

	if (props.triggers) {
		if (Array.isArray(props.triggers)) {
			props.triggers.forEach((trigger) => {
				builder.addTrigger(trigger);
			});
		} else {
			builder.addTrigger(props.triggers);
		}
	}

	if (props.variables) {
		if (Array.isArray(props.variables)) {
			props.variables.forEach((variable) => {
				builder.addVariable(variable);
			});
		} else {
			builder.addVariable(props.variables);
		}
	}

	if (props.stages) {
		if (Array.isArray(props.stages)) {
			props.stages.forEach((stage) => {
				builder.addStage(stage);
			});
		} else {
			builder.addStage(props.stages);
		}
	}

	if (props.artifactStore) {
		builder.setArtifactStores([props.artifactStore]);
	}

	if (props.artifactStores) {
		Object.entries(props.artifactStores).forEach(([region, artifactStore]) => {
			artifactStore.setRegion(region);
			builder.addArtifactStore(artifactStore);
		});
	}

	return builder;
}

export * from "./CodePipelineActionX.mjs";
export * from "./CodePipelineArtifactStoreX.mjs";
export * from "./CodePipelineConditionX.mjs";
export * from "./CodePipelineRulesX.mjs";
export * from "./CodePipelineStageX.mjs";
export * from "./CodePipelineVariableX.mjs";
