import type { GithubJobBuilder } from "../GithubJobBuilder.mjs";
import {
	type GithubOn,
	GithubWorkflowBuilder,
	type GithubWorkflowDefaults,
} from "../GithubWorkflowBuilder.mjs";

export type GithubWorkflowXProps<Uses extends string, With extends string> = {
	name: string;
	on: GithubOn;
	children?: GithubJobBuilder<Uses, With> | GithubJobBuilder<Uses, With>[];
	env?: Record<string, string>;
	defaults?: GithubWorkflowDefaults;
	concurrency?: number;
	packages?: "read" | "write";
	contents?: "read" | "write";
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
}: GithubWorkflowXProps<Uses, With>): GithubWorkflowBuilder<Uses, With> => {
	const factory = new GithubWorkflowBuilder<Uses, With>(name);
	defaults && factory.setDefaults(defaults);
	concurrency && factory.setConcurrency(concurrency);
	factory.setOn(on);

	if (packages || contents) {
		factory.setPermissions({ packages, contents });
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
