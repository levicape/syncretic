import type { PipelineOptions } from "../../cd/pipeline/PipelineOptions.mjs";
import { GithubContext } from "../../cd/pipeline/github/GithubContext.mjs";
import type { GithubStepBuilder } from "../../cd/pipeline/github/GithubStepBuilder.mjs";
import { GithubNodePipelinePackageSteps } from "../../cd/pipeline/github/node/GithubPipelinePackageSteps.mjs";
import { PlatformTargets } from "../../cd/platform/PlatformTargets.mjs";
import { TargetBuilder } from "../../cd/target/TargetBuilder.mjs";

export type GithubWorkflowJobCheckoutProps = {
	options?: PipelineOptions;
};

export function GithubWorkflowJobCheckout<
	Uses extends string,
	With extends string,
>({ options }: Omit<GithubWorkflowJobCheckoutProps, "scripts">) {
	const platform = PlatformTargets.defaultPipeline(options ?? {});

	const { os, arch, abi, baseline } = platform;
	const { getTargetKey, getTargetLabel } = new TargetBuilder<
		GithubStepBuilder<Uses, With>
	>()
		.setOs(os)
		.setArch(arch)
		.setAbi(abi)
		.setBaseline(baseline)
		.setOptions(options ?? {})
		.build();

	const { getCheckoutStep } = new GithubNodePipelinePackageSteps();

	const steps: GithubStepBuilder<string, string>[] = [...getCheckoutStep()];

	return {
		key: getTargetKey(),
		label: getTargetLabel(),
		priority: GithubContext.getPriority(),
		steps,
	};
}
