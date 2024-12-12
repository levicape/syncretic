import type { GithubStep, GithubStepBuilder } from "./GithubStepBuilder.mjs";

export type GithubJob<Uses extends string, With extends string> = {
	name: string;
	"runs-on": string;
	steps?: GithubStep<Uses, With>[];
	needs?: string[];
};

export class GithubJobBuilder<Uses extends string, With extends string> {
	private children: GithubJobBuilder<Uses, With>[] = [];
	private steps: GithubStepBuilder<Uses, With>[] = [];
	private needs: string[] = [];
	private runsOn = "ubuntu-latest";
	private outputs: Record<string, string> = {};
	private inputs: Record<string, string> = {};

	constructor(
		readonly id: string,
		private name: string,
	) {}

	setRunsOn(runsOn: string): this {
		this.runsOn = runsOn;
		return this;
	}

	addNeeds(needs: string[]): this {
		this.needs.push(...needs);
		return this;
	}

	addStep(step: GithubStepBuilder<Uses, With>): this {
		this.steps.push(step);
		return this;
	}

	addChild(job: GithubJobBuilder<Uses, With>): this {
		this.children.push(job);
		return this;
	}

	setSteps(steps: GithubStepBuilder<Uses, With>[]): this {
		this.steps = steps;
		return this;
	}

	setChildren(jobs: GithubJobBuilder<Uses, With>[]): this {
		this.children = jobs;
		return this;
	}

	build(): {
		job: GithubJob<Uses, With>;
		children: GithubJobBuilder<Uses, With>[];
	} {
		if (!this.steps.length) {
			throw new Error("No steps added to job");
		}

		if (!this.id) {
			throw new Error("Job id is required");
		}

		this.children.forEach((job) => {
			job.addNeeds([this.id]);
		});

		return {
			job: {
				name: this.name,
				"runs-on": this.runsOn,
				steps: this.steps.flatMap((step) => {
					console.warn(step);
					return (Array.isArray(step) ? step : [step]).map((s) => s.build());
				}),
				needs: this.needs.length > 0 ? this.needs : undefined,
			},
			children: this.children,
		};
	}
}

export const GithubJobX = <
	Uses extends string = string,
	With extends string = string,
>({
	id,
	name,
	runsOn,
	steps,
	needs,
	children,
}: {
	id: string;
	name: string;
	runsOn?: string;
	steps: GithubStepBuilder<Uses, With>[];
	children?: GithubJobBuilder<Uses, With>[];
	needs?: string[];
}): GithubJobBuilder<Uses, With> => {
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
	return job;
};
