import type { GithubPipelineOptions } from "../pipeline/github/steps/GithubPipelineSteps.mjs";
import type { Platform } from "../platform/Platform.mjs";
import type { Target } from "../target/Target.mjs";

export type VersionStrategyProps = {
	target: Target;
	platform: Platform;
};
export type VersionStrategy = (props: VersionStrategyProps) => {
	target: Target;
	platform: Platform;
	build: {
		id?: string;
		number?: string;
		url?: string;
		label?: string;
	};
	version: {
		string: string;
	};
};

export type PipelinePublishOptions = {
	packageManager: {
		node: "npm" | "pnpm" | "yarn";
	};
	publish: {
		version: VersionStrategy;
		disableGitChecks?: boolean;
	};
} & GithubPipelineOptions;

export type PipelinePublishSteps<Step, Props> = {
	// getVersion: (props: Props) => Step[];
	// getAuthenticatedScope: (props: Props) => Step[];
	// getPublish: (props: Props) => Step[];
};
