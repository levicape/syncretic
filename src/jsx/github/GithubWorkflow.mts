import type { GithubJobBuilder } from "../../ci/cd/pipeline/github/GithubJobBuilder.mts";
import {
	type GithubOn,
	GithubWorkflowBuilder,
	type GithubWorkflowDefaults,
} from "../../ci/cd/pipeline/github/GithubWorkflowBuilder.mts";

export type GithubWorkflowProps<Uses extends string, With extends string> = {
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

export const GithubWorkflow = <
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
}: GithubWorkflowProps<Uses, With>): GithubWorkflowBuilder<Uses, With> => {
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

export * from "../../ci/cd/pipeline/github/GithubContext.mts";
export * from "../../ci/cd/pipeline/github/GithubExecutionCommands.mts";
export * from "../../ci/cd/pipeline/github/GithubJobBuilder.mts";
export * from "../../ci/cd/pipeline/github/GithubStepBuilder.mts";
export * from "../../ci/cd/pipeline/github/GithubWorkflowBuilder.mts";
export * from "../../ci/cd/pipeline/github/GithubWorkflowExpressions.mts";
export * from "./GithubJob.mts";
export * from "./GithubStep.mts";
