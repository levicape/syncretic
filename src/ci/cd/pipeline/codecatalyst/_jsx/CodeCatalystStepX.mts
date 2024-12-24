import { CodeCatalystStepBuilder } from "../CodeCatalystStepBuilder.mjs";

export type CodeCatalystStepXProps = {
	run: string;
};

export const CodeCatalystStepX = (
	props: CodeCatalystStepXProps,
): CodeCatalystStepBuilder => {
	const { run } = props;
	const factory = new CodeCatalystStepBuilder(run);
	return factory;
};
