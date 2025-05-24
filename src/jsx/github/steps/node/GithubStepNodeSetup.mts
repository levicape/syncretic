import { GithubNodeWorkflowJobSetup } from "../../../../ci/codegen/github/node/GithubNodeWorkflowJobStepCodegen.mts";

export type GithubNodeWorkflowJobProps = Parameters<
	typeof GithubNodeWorkflowJobSetup
>[0];

export const GithubStepNodeSetup = (props: GithubNodeWorkflowJobProps) => {
	return GithubNodeWorkflowJobSetup(props).steps;
};
