import { GithubNodeWorkflowJobInstall } from "../../../../ci/codegen/github/node/GithubNodeWorkflowJobStepCodegen.mjs";

export const GithubStepNodeInstallX = (
	props: Parameters<typeof GithubNodeWorkflowJobInstall>[0],
) => {
	return GithubNodeWorkflowJobInstall(props).steps;
};
