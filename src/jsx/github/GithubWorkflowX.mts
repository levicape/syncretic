import type { GithubJobBuilder } from "../../ci/cd/pipeline/github/GithubJobBuilder.mjs";
import {
	type GithubOn,
	GithubWorkflowBuilder,
	type GithubWorkflowDefaults,
} from "../../ci/cd/pipeline/github/GithubWorkflowBuilder.mjs";

export type GithubWorkflowXProps<Uses extends string, With extends string> = {
	name: string;
	on: GithubOn;
	children?: GithubJobBuilder<Uses, With> | GithubJobBuilder<Uses, With>[];
	env?: Record<string, string>;
	defaults?: GithubWorkflowDefaults;
	concurrency?: number;
	packages?: "read" | "write";
	contents?: "read" | "write";
	["id-token"]?: "read" | "write";
};

export const GithubWorkflowX = <
	Uses extends string = string,
	With extends string = string,
>({
	name,
	on,
	children,
	env,
	defaults,
	concurrency,
	packages,
	contents,
	["id-token"]: idToken,
}: GithubWorkflowXProps<Uses, With>): GithubWorkflowBuilder<Uses, With> => {
	const factory = new GithubWorkflowBuilder<Uses, With>(name);
	defaults && factory.setDefaults(defaults);
	concurrency && factory.setConcurrency(concurrency);
	factory.setOn(on);

	if (packages || contents || idToken) {
		factory.setPermissions({ packages, contents, ["id-token"]: idToken });
	}

	if (children) {
		if (!Array.isArray(children)) {
			children = [children];
		}
		children.forEach((job) => {
			factory.addJob(job);
		});
	}

	if (env) {
		factory.setEnv(env);
	}

	return factory;
};

export * from "./../../ci/cd/pipeline/github/GithubContext.mjs";
export * from "./../../ci/cd/pipeline/github/GithubExecutionCommands.mjs";
export * from "./../../ci/cd/pipeline/github/GithubJobBuilder.mjs";
export * from "./../../ci/cd/pipeline/github/GithubStepBuilder.mjs";
export * from "./../../ci/cd/pipeline/github/GithubWorkflowBuilder.mjs";
export * from "./../../ci/cd/pipeline/github/GithubWorkflowExpressions.mjs";
export * from "./GithubJobX.mjs";
export * from "./GithubStepX.mjs";
export * from "./steps/GithubStepCheckoutX.mjs";
export * from "./steps/node/GithubStepNodeInstallX.mjs";
export * from "./steps/node/GithubStepNodeScriptsX.mjs";
export * from "./steps/node/GithubStepNodeSetupX.mjs";
