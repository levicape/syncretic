import { GithubNodeWorkflowJobInstall } from "../../../../ci/codegen/github/node/GithubNodeWorkflowJobStepCodegen.mjs";

export const GithubStepNodeInstall = (
	props: Parameters<typeof GithubNodeWorkflowJobInstall>[0],
) => {
	return GithubNodeWorkflowJobInstall(props).steps;
};
