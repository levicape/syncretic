import {
	CodePipelineActionBuilder,
	type CodePipelineActionCategoryAnySpec,
	type CodePipelineActionCategoryComputeSpec,
	type CodePipelineActionCategorySourceSpec,
} from "../../ci/cd/pipeline/codepipeline/CodePipelineAction.mjs";
import type { Region } from "../../ci/cd/pipeline/codepipeline/CodePipelineDefinition.mjs";

export type CodePipelineActionXProps = {
	name: string;
	namespace?: string;
	region?: Region;
	roleArn?: string;
	timeoutInMinutes?: number;
	commands?: string[];
	runOrder?: number;
} & CodePipelineActionCategoryAnySpec;

export function CodePipelineActionX(
	props:
		| CodePipelineActionXProps
		| CodePipelineActionSourceXProps
		| CodePipelineActionComputeXProps,
) {
	const builder = new CodePipelineActionBuilder();

	builder.setActionTypeId(props.actionTypeId);
	builder.setName(props.name);
	builder.setConfiguration(props.configuration);
	builder.setOutputArtifacts(props.outputArtifacts);
	builder.setInputArtifacts(props.inputArtifacts);
	if (props.outputVariables) {
		builder.setOutputVariables(props.outputVariables);
	}
	if (props.runOrder) {
		builder.setRunOrder(props.runOrder);
	}

	if (props.namespace) {
		builder.setNamespace(props.namespace);
	}

	if (props.commands) {
		builder.setCommands(props.commands);
	}

	if (props.region) {
		builder.setRegion(props.region);
	}

	if (props.timeoutInMinutes) {
		builder.setTimeoutInMinutes(props.timeoutInMinutes);
	}

	if (props.roleArn) {
		builder.setRoleArn(props.roleArn);
	}

	return builder;
}

export type CodePipelineActionSourceXProps = {
	name: string;
	namespace?: string;
	region?: Region;
	roleArn?: string;
	timeoutInMinutes?: number;
	commands?: string[];
	runOrder?: number;
} & CodePipelineActionCategorySourceSpec;

export type CodePipelineActionComputeXProps = {
	name: string;
	namespace?: string;
	region?: Region;
	roleArn?: string;
	timeoutInMinutes?: number;
	commands?: string[];
	runOrder?: number;
} & CodePipelineActionCategoryComputeSpec;

export type CodePipelineParallelActionXProps = {
	children: CodePipelineActionBuilder[];
};

export function CodePipelineParallelActionX(
	props: CodePipelineParallelActionXProps,
): CodePipelineActionBuilder[] {
	return props.children;
}
