import type { GithubPipelineOptions } from "../pipeline/github/steps/GithubPipelineSteps.mjs";

export type PipelinePackageOptions = {
	packageManager: {
		node: "npm" | "pnpm" | "yarn";
	};
	registry: {
		scope: string;
	};
} & GithubPipelineOptions;

export type PipelinePackageSteps<Step, Props> = {
	getCheckoutStep: (props: Props) => Step[];
	getPackageManager: (props: Props) => Step[];
	getRuntime: (props: Props) => Step[];
	getInstallModules: (props: Props) => Step[];
	getScript: <Options>(
		props: Props,
	) => (script: string, options: Options) => Step;
};
