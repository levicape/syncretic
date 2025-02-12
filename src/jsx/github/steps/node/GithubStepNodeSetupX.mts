import { GithubNodeWorkflowJobSetup } from "../../../../ci/codegen/github/node/GithubNodeWorkflowJobStepCodegen.mjs";

export type GithubNodeWorkflowJobXProps = Parameters<
	typeof GithubNodeWorkflowJobSetup
>[0];

export const GithubStepNodeSetupX = (props: GithubNodeWorkflowJobXProps) => {
	return GithubNodeWorkflowJobSetup(props).steps;
};
