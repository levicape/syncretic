import { GithubWorkflowJobCheckout } from "../../../ci/codegen/github/GithubWorkflowJobStepCodegen.mjs";

export const GithubStepCheckoutX = (
	props: Parameters<typeof GithubWorkflowJobCheckout>[0],
) => {
	return GithubWorkflowJobCheckout(props).steps;
};
