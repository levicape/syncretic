import { GithubNodeWorkflowJobScript } from "../../../../../../codegen/github/node/GithubNodeWorkflowJobStepCodegen.mjs";

export const GithubStepNodeScriptsX = (
	props: Parameters<typeof GithubNodeWorkflowJobScript>[0],
) => {
	return GithubNodeWorkflowJobScript(props).steps;
};
