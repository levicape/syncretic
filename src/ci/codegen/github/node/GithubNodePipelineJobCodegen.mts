import type { PipelineOptions } from "../../../cd/pipeline/Pipeline.mjs";
import { GithubContext } from "../../../cd/pipeline/github/GithubContext.mjs";
import type {
	GithubStep,
	GithubStepBuilder,
} from "../../../cd/pipeline/github/GithubStepBuilder.mjs";
import { GithubNodePipelinePackageSteps } from "../../../cd/pipeline/github/steps/GithubPipelinePackageSteps.mjs";
import { PlatformTargets } from "../../../cd/platform/PlatformTargets.mjs";
import type { PipelinePackageOptions } from "../../../cd/steps/PipelinePackageSteps.mjs";
import { TargetBuilder } from "../../../cd/target/TargetBuilder.mjs";

export type GithubNodePipelineJobProps = {
	configuration: PipelinePackageOptions;
	options: PipelineOptions;
	scripts?: Readonly<string[]>;
	children?: (
		props: Omit<GithubNodePipelineJobProps, "children">,
	) => GithubStepBuilder<string, string>[];
};

export const GithubNodePipelineJobDefaultScripts = () => ["build:ci"] as const;

export function GithubNodePipelineJobSetup<
	Uses extends string,
	With extends string,
>({ configuration, options, scripts, children }: GithubNodePipelineJobProps) {
	const platform = PlatformTargets.defaultPipeline(options);

	const { os, arch, abi, baseline } = platform;
	const { getTargetKey, getTargetLabel } = new TargetBuilder<
		GithubStepBuilder<Uses, With>
	>()
		.setOs(os)
		.setArch(arch)
		.setAbi(abi)
		.setBaseline(baseline)
		.setOptions(options)
		.build();

	const {
		getCheckoutStep,
		getPackageManager,
		getRuntime,
		getInstallModules,
		getScript,
	} = new GithubNodePipelinePackageSteps();

	const platformOptions = {
		...configuration,
	};

	let script = getScript(platformOptions);
	const steps: GithubStepBuilder<string, string>[] = [
		...getCheckoutStep(),
		...getPackageManager(platformOptions),
		...getRuntime(platformOptions),
		...getInstallModules(platformOptions),
	];

	if (scripts) {
		steps.push(...scripts.flatMap((run) => script(run)));
	}

	if (children) {
		steps.push(...children({ configuration, options }));
	}

	return {
		key: getTargetKey(),
		label: getTargetLabel(),
		priority: GithubContext.getPriority(),
		steps,
	};
}

export function GithubNodePipelineJobScripts<
	Uses extends string,
	With extends string,
>({
	configuration,
	options,
	scripts,
}: GithubNodePipelineJobProps & { scripts: Readonly<string[]> }) {
	const platform = PlatformTargets.defaultPipeline(options);

	const { os, arch, abi, baseline } = platform;
	const { getTargetKey, getTargetLabel } = new TargetBuilder<
		GithubStep<Uses, With>
	>()
		.setOs(os)
		.setArch(arch)
		.setAbi(abi)
		.setBaseline(baseline)
		.setOptions(options)
		.build();

	const { getScript } = new GithubNodePipelinePackageSteps();

	const platformOptions = {
		...configuration,
	};

	let script = getScript(platformOptions);
	const steps: GithubStepBuilder<string, string>[] = [
		...scripts.flatMap((run) => script(run)),
	];

	return {
		key: getTargetKey(),
		label: getTargetLabel(),
		priority: GithubContext.getPriority(),
		steps,
	};
}
