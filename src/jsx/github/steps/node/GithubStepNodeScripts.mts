import { GithubNodeWorkflowJobScript } from "../../../../ci/codegen/github/node/GithubNodeWorkflowJobStepCodegen.mts";

export const GithubStepNodeScripts = (
	props: Parameters<typeof GithubNodeWorkflowJobScript>[0],
) => {
	return GithubNodeWorkflowJobScript(props).steps;
};
