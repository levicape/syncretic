import type {
	Platform,
	PlatformPrototype,
} from "../../../platform/Platform.mjs";
import { PlatformBuilder } from "../../../platform/PlatformBuilder.mjs";
import type {
	PipelineDeployOptions,
	PipelineDeploySteps,
} from "../../../steps/PipelineDeploySteps.mjs";
import type { Target, TargetPrototype } from "../../../target/Target.mjs";
import { TargetBuilder } from "../../../target/TargetBuilder.mjs";
import type { PipelineOptions } from "../../PipelineOptions.mjs";
import { type GithubStep, GithubStepBuilder } from "../GithubStepBuilder.mjs";

export type GithubPipelineNodeDeployProps = {
	version: {
		node?: "20";
	};
};

export class GithubPipelineDeploySteps<Uses extends string, With extends string>
	implements
		PipelineDeploySteps<GithubStep<Uses, With>, GithubPipelineNodeDeployProps>
{
	private platform: Platform & PlatformPrototype<GithubStep<Uses, With>>;
	private target: Target & TargetPrototype<GithubStep<Uses, With>>;
	private options: PipelineOptions;
	private deploy: PipelineDeployOptions;

	constructor(platform: Platform, options: PipelineOptions) {
		this.platform = new PlatformBuilder<GithubStep<Uses, With>>()
			.setOs(platform.os)
			.setArch(platform.arch)
			.setAbi(platform.abi)
			.setBaseline(platform.baseline)
			.setDistro(platform.distro || "")
			.setRelease(platform.release)
			.setOptions(options)
			.build();

		this.target = new TargetBuilder()
			.setOs(platform.os)
			.setArch(platform.arch)
			.setAbi(platform.abi)
			.setBaseline(platform.baseline)
			.setOptions(options)
			.build();

		this.options = options;
	}
	setDeployOptions(push: PipelineDeployOptions): this {
		this.deploy = push;
		return this;
	}
}
