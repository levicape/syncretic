import { env } from "node:process";
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
import { GithubContext } from "./GithubContext.mjs";
import { type GithubStep, GithubStepBuilder } from "./GithubStepBuilder.mjs";

type U = string;
type W = string;

export class GithubPipelineTargetSteps
	implements PipelineTargetSteps<GithubStep<U, W>>
{
	private platform: Platform & PlatformPrototype<GithubStep<U, W>>;
	private target: Target & TargetPrototype<GithubStep<U, W>>;
	private options: PipelineOptions;

	constructor(platform: Platform, options: PipelineOptions) {
		this.platform = new PlatformBuilder<GithubStep<U, W>>()
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
	get = () => {
		return [
			new GithubStepBuilder("Checkout", "actions/checkout@v4", {}).build(),
		] as const;
	};
	getPackageManager = () => {
		return [
			new GithubStepBuilder("Setup pnpm", "pnpm/action-setup@v4", {}).build(),
		] as const;
	};
	// getSetupRegistry = ({ env, secrets })
	getSetupRegistry = () => {
		return [
			new GithubStepBuilder("Setup node", "actions/setup-node@v4", {
				"node-version": this.platform.baseline ? "22" : "23",
				"registry-url": `${"env(NPM_REGISTRY_URL)"}://`,
				cache: "pnpm",
				"cache-dependency-path": "pnpm-lock.yaml",
				scope: "@levicape",
			})
				.setEnv({
					NODE_AUTH_TOKEN: `${"secrets(NPM_TOKEN)"}`,
				})
				.build(),
			new GithubStepBuilder("Cache node_modules", "actions/cache@v3", {
				path: "node_modules",
				key: "pnpm-cache",
				"restore-keys": "pnpm-cache",
			})
				.setEnv({
					"cache-name": "cache-node-modules",
				})
				.setId("cache-npm")
				.build(),
		] as const;
	};
}
