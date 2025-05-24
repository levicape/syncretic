import { GithubWorkflowJobCheckout } from "../../../ci/codegen/github/GithubWorkflowJobStepCodegen.mts";

export const GithubStepCheckout = () => {
	return GithubWorkflowJobCheckout().steps;
};
