import type { PipelineOptions } from "../../../cd/pipeline/Pipeline.mjs";
import { GithubContext } from "../../../cd/pipeline/github/GithubContext.mjs";
import type {
	GithubStep,
	GithubStepBuilder,
} from "../../../cd/pipeline/github/GithubStepBuilder.mjs";
import {
	type GithubPipelineNodeOptions,
	GithubWorkflowExpressions,
} from "../../../cd/pipeline/github/index.mjs";
import { GithubNodePipelinePackageSteps } from "../../../cd/pipeline/github/node/GithubPipelinePackageSteps.mjs";
import { PlatformTargets } from "../../../cd/platform/PlatformTargets.mjs";
import type { PipelinePackageOptions } from "../../../cd/steps/PipelinePackageSteps.mjs";
import { TargetBuilder } from "../../../cd/target/TargetBuilder.mjs";

export type GithubNodeWorkflowJobProps = {
	configuration: PipelinePackageOptions<GithubPipelineNodeOptions>;
	options?: PipelineOptions;
	scripts?: Readonly<string[]>;
	children?: (
		props: Omit<GithubNodeWorkflowJobProps, "children">,
	) => GithubStepBuilder<string, string>[];
};

export function GithubNodeWorkflowJobSetup<
	Uses extends string,
	With extends string,
>(props: GithubNodeWorkflowJobProps) {
	const { configuration, scripts, children } = props;
	let options = props.options ?? {};

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

	const { getPackageManager, getRuntime, getScript } =
		new GithubNodePipelinePackageSteps();

	const expressions = GithubWorkflowExpressions.current;
	const platformOptions = {
		...configuration,
		expressions,
	};

	let script = getScript(platformOptions);
	const steps: GithubStepBuilder<Uses, With>[] = [
		...getPackageManager(platformOptions),
		...getRuntime(platformOptions),
	] as GithubStepBuilder<Uses, With>[];

	if (scripts) {
		steps.push(
			...scripts.flatMap((run) => script(run) as GithubStepBuilder<Uses, With>),
		);
	}

	if (children) {
		steps.push(
			...(children({ configuration, options }) as GithubStepBuilder<
				Uses,
				With
			>[]),
		);
	}

	return {
		key: getTargetKey(),
		label: getTargetLabel(),
		priority: GithubContext.getPriority(),
		steps,
	};
}

export function GithubNodeWorkflowJobInstall<
	Uses extends string,
	With extends string,
>(props: GithubNodeWorkflowJobProps) {
	const { configuration, scripts, children } = props;
	let options = props.options ?? {};
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

	const { getInstallModules, getScript } = new GithubNodePipelinePackageSteps();

	const expressions = GithubWorkflowExpressions.current;
	const platformOptions = {
		...configuration,
		expressions,
	};

	let script = getScript(platformOptions);
	const steps: GithubStepBuilder<Uses, With>[] = [
		...getInstallModules(platformOptions),
	] as GithubStepBuilder<Uses, With>[];

	if (scripts) {
		steps.push(
			...scripts.flatMap((run) => script(run) as GithubStepBuilder<Uses, With>),
		);
	}

	if (children) {
		steps.push(
			...(children({
				configuration,
				options,
			} as GithubNodeWorkflowJobProps) as GithubStepBuilder<Uses, With>[]),
		);
	}

	return {
		key: getTargetKey(),
		label: getTargetLabel(),
		priority: GithubContext.getPriority(),
		steps,
	};
}

export function GithubNodeWorkflowJobScript<
	Uses extends string,
	With extends string,
>(props: GithubNodeWorkflowJobProps & { scripts: Readonly<string[]> }) {
	const { configuration, scripts } = props;
	let options = props.options ?? {};
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

	const expressions = GithubWorkflowExpressions.current;
	const platformOptions = {
		...configuration,
		expressions,
	};

	let script = getScript(platformOptions);
	const steps: GithubStepBuilder<Uses, With>[] = [
		...scripts.flatMap((run) => script(run) as GithubStepBuilder<Uses, With>),
	];

	return {
		key: getTargetKey(),
		label: getTargetLabel(),
		priority: GithubContext.getPriority(),
		steps,
	};
}
