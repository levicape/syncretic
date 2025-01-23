import type { PipelineOptions } from "../../cd/pipeline/Pipeline.mjs";
import {
	BuildkiteContext,
	type BuildkiteStep,
} from "../../cd/pipeline/buildkite/BuildkiteContext.mjs";
import { BuildkitePipelineTargetSteps } from "../../cd/pipeline/buildkite/BuildkitePipelineTargetSteps.mjs";
import { BuildkiteStepBuilder } from "../../cd/pipeline/buildkite/BuildkiteStepBuilder.mjs";
import { PlatformTargets } from "../../cd/platform/PlatformTargets.mjs";
import { TargetBuilder } from "../../cd/target/TargetBuilder.mjs";
import { isFork, isMainBranch } from "../../machine/code/Git.mjs";

/**
 * Build and test Node on macOS, Linux, and Windows.
 * @link https://buildkite.com/docs/pipelines/defining-steps
 */
export function BuildkitePipelineCodegen(options: PipelineOptions) {
	const { buildId, buildImages, skipTests } = options;

	const steps: BuildkiteStep[] = [];
	const imagePlatforms = PlatformTargets.imagePlatforms<BuildkiteStep>(options);
	if (imagePlatforms.size) {
		steps.push(
			new BuildkiteStepBuilder(
				":docker:",
				[...imagePlatforms.values()]
					.map((platform) => platform.getBuildImageStep())
					.map((step) => step.command)
					.join("\n"),
			).build(),
		);
	}

	const buildPlatforms = PlatformTargets.buildPlatforms<BuildkiteStep>(options);
	for (const platform of buildPlatforms) {
		const { os, arch, abi, baseline } = platform;
		const { getTargetKey, getTargetLabel } = new TargetBuilder<BuildkiteStep>()
			.setOs(os)
			.setArch(arch)
			.setAbi(abi)
			.setBaseline(baseline)
			.setOptions(options)
			.build();

		const platformSteps: BuildkiteStep[] = [];
		const {
			getBuildVendorStep,
			getBuildCppStep,
			getBuildZigStep,
			getBuildNodeStep,
		} = new BuildkitePipelineTargetSteps(platform, options);

		if (buildImages || !buildId) {
			platformSteps.push(
				getBuildVendorStep(),
				getBuildCppStep(),
				getBuildZigStep(),
				getBuildNodeStep(),
			);
		}

		if (!skipTests) {
			platformSteps.push(
				...PlatformTargets.testPlatforms<BuildkiteStep>(options)
					.filter(
						(testPlatform) =>
							testPlatform.os === os &&
							testPlatform.arch === arch &&
							testPlatform.abi === abi &&
							testPlatform.baseline === baseline,
					)
					.map((testPlatform) =>
						new BuildkitePipelineTargetSteps(
							testPlatform,
							options,
						).getTestNodeStep(),
					),
			);
		}

		if (!platformSteps.length) {
			continue;
		}

		steps.push(
			new BuildkiteStepBuilder(getTargetKey(), getTargetLabel())
				.setGroup(getTargetLabel())
				.setSteps(platformSteps)
				.build(),
		);

		if (isMainBranch() && !isFork()) {
			steps.push(
				new BuildkiteStepBuilder(
					":github:",
					".buildkite/scripts/upload-release.sh",
				)
					.setAgents({
						queue: "test-darwin",
					})
					.setDependsOn(
						PlatformTargets.buildPlatforms<BuildkiteStep>(options).map(
							(platform) => {
								const target = new TargetBuilder<BuildkiteStep>()
									.setOs(platform.os)
									.setArch(platform.arch)
									.setAbi(platform.abi)
									.setBaseline(platform.baseline)
									.build();
								return `${target.getTargetKey()}-build-node`;
							},
						),
					)
					.build(),
			);
		}
	}

	return {
		priority: BuildkiteContext.getPriority(),
		steps,
	};
}
