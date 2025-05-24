import { CodeCatalystStepBuilder } from "../../ci/cd/pipeline/codecatalyst/CodeCatalystStepBuilder.mts";

export type CodeCatalystStepProps = {
	run: string;
};

export const CodeCatalystStep = (
	props: CodeCatalystStepProps,
): CodeCatalystStepBuilder => {
	const { run } = props;
	const factory = new CodeCatalystStepBuilder(run);
	return factory;
};
