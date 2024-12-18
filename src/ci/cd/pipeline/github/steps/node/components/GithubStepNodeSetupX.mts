import { GithubNodeWorkflowJobSetup } from "../../../../../../codegen/github/node/GithubNodeWorkflowJobStepCodegen.mjs";

export const GithubStepNodeSetupX = (
	props: Parameters<typeof GithubNodeWorkflowJobSetup>[0],
) => {
	return GithubNodeWorkflowJobSetup(props).steps;
};
