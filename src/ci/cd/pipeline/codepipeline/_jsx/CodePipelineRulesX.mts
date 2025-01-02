import type { Region } from "../CodePipelineDefinition.mjs";
import { CodePipelineRuleBuilder } from "../CodePipelineRule.mjs";

export type CodePipelineRuleXProps = {
	name: string;
	ruleTypeId: {
		category: "Rule";
		provider: string;
		owner?: "AWS";
		version?: string;
	};
	commands?: string[];
	configuration?: Record<string, string>;
	inputArtifacts?: { name: string }[];
	region?: Region;
	timeoutInMinutes?: number;
	roleArn?: string;
};

export function CodePipelineRuleX(props: CodePipelineRuleXProps) {
	const builder: CodePipelineRuleBuilder = new CodePipelineRuleBuilder(
		props.name,
	);
	if (props.commands) {
		builder.setCommands(props.commands);
	}
	if (props.configuration) {
		builder.setConfiguration(props.configuration);
	}
	if (props.inputArtifacts) {
		builder.setInputArtifacts(props.inputArtifacts);
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
