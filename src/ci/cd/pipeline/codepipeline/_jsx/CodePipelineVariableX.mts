import { CodePipelineVariableBuilder } from "../CodePipelineVariable.mjs";

export type CodePipelineVariableXProps = {
	name: string;
	children?: string;
	description?: string;
};

export function CodePipelineVariableX(props: CodePipelineVariableXProps) {
	const builder: CodePipelineVariableBuilder = new CodePipelineVariableBuilder(
		props.name,
	);
	if (props.children) {
		builder.setDefaultValue(props.children);
	}
	if (props.description) {
		builder.setDescription(props.description);
	}

	return builder;
}
