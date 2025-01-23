import { isMainBranch, isMergeQueue } from "../../../machine/code/Git.mjs";
import type { Platform, PlatformPrototype } from "../../platform/Platform.mjs";
import { PlatformBuilder } from "../../platform/PlatformBuilder.mjs";
import type { Target, TargetPrototype } from "../../target/Target.mjs";
import { TargetBuilder } from "../../target/TargetBuilder.mjs";
import {
	Pipeline,
	type PipelineOptions,
	type PipelineTargetSteps,
} from "../Pipeline.mjs";
import { BuildkiteContext, type BuildkiteStep } from "./BuildkiteContext.mjs";
import { BuildkiteStepBuilder } from "./BuildkiteStepBuilder.mjs";

export class BuildkitePipelineTargetSteps
	implements PipelineTargetSteps<BuildkiteStep>
{
	private platform: Platform & PlatformPrototype<BuildkiteStep>;
	private target: Target & TargetPrototype<BuildkiteStep>;
	private options: PipelineOptions;

	constructor(platform: Platform, options: PipelineOptions) {
		this.platform = new PlatformBuilder<BuildkiteStep>()
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

	getBuildVendorStep = (): BuildkiteStep => {
		return new BuildkiteStepBuilder(
			`${this.platform.getPlatformKey()}-build-vendor`,
			"npm run build:ci --target dependencies",
		)
			.setLabel(`${this.platform.getPlatformLabel()} - build-vendor`)
			.setAgents(this.platform.getBuildAgent())
			.setRetry(Pipeline.getRetry())
			.setCancelOnBuildFailing(isMergeQueue())
			.setEnv(BuildkiteContext.getBuildEnv(this.platform))
			.setDependsOn(this.platform.getDependsOn())
			.build();
	};

	getBuildCppStep = (): BuildkiteStep => {
		return new BuildkiteStepBuilder(
			`${this.platform.getPlatformKey()}-build-cpp`,
			"npm run build:ci --target node",
		)
			.setLabel(`${this.platform.getPlatformLabel()} - build-cpp`)
			.setAgents(this.platform.getBuildAgent())
			.setRetry(Pipeline.getRetry())
			.setCancelOnBuildFailing(isMergeQueue())
			.setEnv({
				NODE_CPP_ONLY: "ON",
				...BuildkiteContext.getBuildEnv(this.platform),
			})
			.setDependsOn(this.platform.getDependsOn())
			.build();
	};

	getBuildZigStep = (): BuildkiteStep => {
		const toolchain = this.target.getBuildToolchain();
		return new BuildkiteStepBuilder(
			`${this.platform.getPlatformKey()}-build-zig`,
			`npm run build:ci --target node-zig --toolchain ${toolchain}`,
		)
			.setLabel(`${this.platform.getPlatformLabel()} - build-zig`)
			.setAgents(this.target.getZigAgent())
			.setRetry(Pipeline.getRetry(1)) // FIXME: Sometimes zig build hangs, so we need to retry once
			.setCancelOnBuildFailing(isMergeQueue())
			.setEnv(BuildkiteContext.getBuildEnv(this.platform))
			.setDependsOn(this.platform.getDependsOn())
			.build();
	};

	getBuildNodeStep = (): BuildkiteStep => {
		return new BuildkiteStepBuilder(
			`${this.platform.getPlatformKey()}-build-node`,
			"node run build:ci --target node",
		)
			.setLabel(`${this.platform.getPlatformLabel()} - build-node`)
			.setDependsOn([
				`${this.platform.getPlatformKey()}-build-vendor`,
				`${this.platform.getPlatformKey()}-build-cpp`,
				`${this.platform.getPlatformKey()}-build-zig`,
			])
			.setAgents(this.platform.getBuildAgent())
			.setRetry(Pipeline.getRetry())
			.setCancelOnBuildFailing(isMergeQueue())
			.setEnv({
				NODE_LINK_ONLY: "ON",
				...BuildkiteContext.getBuildEnv(this.platform),
			})
			.build();
	};

	getTestNodeStep = (): BuildkiteStep => {
		return new BuildkiteStepBuilder(
			`${this.platform.getPlatformKey()}-test-node`,
			`node ./ci/runner.node.js --step ${this.platform.getPlatformKey()}-build-node`,
		)
			.setLabel(`${this.platform.getPlatformLabel()} - test-node`)
			.setDependsOn([
				...this.platform.getDependsOn(
					`${this.platform.getPlatformKey()}-test-node`,
				),
			])
			.setAgents(this.platform.getTestAgent())
			.setRetry(Pipeline.getRetry(1))
			.setCancelOnBuildFailing(isMergeQueue())
			.setSoftFail(isMainBranch() ? true : [{ exit_status: 2 }])
			.setParallelism(this.target.getParallelism())
			.setEnv(
				this.options.buildId
					? { BUILDKITE_ARTIFACT_BUILD_ID: this.options.buildId }
					: {},
			)
			.build();
	};
}
