// import { Platform, type PlatformPrototype } from "../../../platform/Platform.mjs";
// import { PlatformBuilder } from "../../../platform/PlatformBuilder.mjs";
// import type { PipelinePushOptions, PipelinePushSteps } from "../../../steps/PipelinePushSteps.mjs";
// import { TargetBuilder } from "../../../target/TargetBuilder.mjs";
// import { type Target, type TargetPrototype } from "../../../target/Target.mjs";
// import type { PipelineOptions } from "../../PipelineOptions.mjs";
// import { GithubStepBuilder, type GithubStep } from "../GithubStepBuilder.mjs";
// export type GithubPipelineNodePushProps = {
// 	nodeVersion?: "20" | "22";
// };

// export class GithubPipelinePushSteps<Uses extends string, With extends string> implements PipelinePushSteps<GithubStep<Uses, With>, GithubPipelineNodePushProps>
// {
// 	private platform: Platform & PlatformPrototype<GithubStep<Uses, With>>;
// 	private target: Target & TargetPrototype<GithubStep<Uses, With>>;
// 	private options: PipelineOptions;
// 	private push: PipelinePushOptions;

// 	constructor(platform: Platform, options: PipelineOptions) {
// 		this.platform = new PlatformBuilder<GithubStep<Uses, With>>()
// 			.setOs(platform.os)
// 			.setArch(platform.arch)
// 			.setAbi(platform.abi)
// 			.setBaseline(platform.baseline)
// 			.setDistro(platform.distro || "")
// 			.setRelease(platform.release)
// 			.setOptions(options)
// 			.build();

// 		this.target = new TargetBuilder()
// 			.setOs(platform.os)
// 			.setArch(platform.arch)
// 			.setAbi(platform.abi)
// 			.setBaseline(platform.baseline)
// 			.setOptions(options)
// 			.build();

// 		this.options = options;
// 	}
// 	setPush(push: PipelinePushOptions): this {
// 		this.push = push;
// 		return this;
// 	}

// 	getListDependencies = ({ nodeVersion }: GithubPipelineNodePushProps) => {
// 		return [
// 			new GithubStepBuilder<Uses, With>(
// 				"List Dependencies",
// 				"actions/setup-node@v2" as Uses,
// 				{
// 					["node-version" as With]: nodeVersion as string | undefined
// 				} as unknown as Record<With, string | undefined>)
// 			.setRun([
// 				"npm list"
// 			])
// 			.build()
// 		];
// 	}
// }
