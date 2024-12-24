import {
	GithubJobBuilder,
	type GithubJobDefaultsSpec,
	type GithubJobImageSpec,
	type GithubJobStrategySpec,
} from "../GithubJobBuilder.mjs";
import type { GithubStepBuilder } from "../GithubStepBuilder.mjs";

export type GithubJobXProps<Uses extends string, With extends string> = {
	id: string;
	name: string;
	runsOn?: string;
	steps: GithubStepBuilder<Uses, With>[];
	children?: GithubJobBuilder<Uses, With>[];
	needs?: string[];
	packages?: "read" | "write";
	contents?: "read" | "write";
	if?: string;
	outputs?: Record<string, string>;
	env?: Record<string, string>;
	enviroment?: string;
	concurrency?: number;
	defaults?: GithubJobDefaultsSpec;
	strategy?: GithubJobStrategySpec;
	continueOnError?: string;
	container?: GithubJobImageSpec;
	services?: Record<string, GithubJobImageSpec>;
};

export const GithubJobX = <Uses extends string, With extends string>({
	id,
	name,
	runsOn,
	steps,
	needs,
	children,
	packages,
	contents,
	if: _if,
	outputs,
	env,
	enviroment,
	concurrency,
	defaults,
	strategy,
	continueOnError,
	container,
	services,
}: GithubJobXProps<Uses, With>): GithubJobBuilder<Uses, With> => {
	const job = new GithubJobBuilder<Uses, With>(id, name);
	if (runsOn) {
		job.setRunsOn(runsOn);
	}
	job.setSteps(steps);
	if (needs) {
		job.addNeeds(needs);
	}
	if (children) {
		job.setChildren(children);
	}
	if (packages || contents) {
		job.setPermissions({ packages, contents });
	}
	if (_if) {
		job.setIf(_if);
	}
	if (outputs) {
		job.setOutputs(outputs);
	}
	if (env) {
		job.setEnv(env);
	}
	if (enviroment) {
		job.setEnvironment(enviroment);
	}
	if (concurrency) {
		job.setConcurrency(concurrency);
	}
	if (defaults) {
		job.setDefaults(defaults);
	}
	if (strategy) {
		job.setStrategy(strategy);
	}
	if (continueOnError) {
		job.setContinueOnError(continueOnError);
	}
	if (container) {
		job.setContainer(container);
	}
	if (services) {
		job.setServices(services);
	}
	return job;
};
