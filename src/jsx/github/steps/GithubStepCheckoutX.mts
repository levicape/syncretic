import { GithubWorkflowJobCheckout } from "../../../ci/codegen/github/GithubWorkflowJobStepCodegen.mjs";

export const GithubStepCheckoutX = () => {
	return GithubWorkflowJobCheckout().steps;
};
