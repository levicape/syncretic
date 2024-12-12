import type {
	GithubJob,
	GithubJobBuilder,
	GithubJobX,
} from "./GithubJobBuilder.mjs";

export type GithubOnPushSpec = {
	branches: string[];
};

export type GithubOn = {
	push?: GithubOnPushSpec;
};

export type GithubPipeline<Uses extends string, With extends string> = {
	name: string;
	on: GithubOn;
	jobs?: Record<string, GithubJob<Uses, With>>;
	env?: Record<string, string>;
};

export class GithubPipelineBuilder<Uses extends string, With extends string> {
	private jobs: GithubJobBuilder<Uses, With>[] = [];
	private on?: GithubOn;
	private env: Record<string, string> = {};

	constructor(private name: string) {}

	addJob(job: GithubJobBuilder<Uses, With>): this {
		this.jobs.push(job);
		return this;
	}

	setEnv(env: Record<string, string>): this {
		this.env = env;
		return this;
	}

	setOnPush(branches: string[]): this {
		this.on = {
			push: {
				branches,
			},
		};

		return this;
	}

	build(): GithubPipeline<Uses, With> {
		if (!this.jobs.length) {
			throw new Error("No jobs added to pipline");
		}

		if (!this.on) {
			throw new Error("No on added to pipeline");
		}

		return {
			name: this.name,
			on: this.on,
			...(Object.keys(this.env).length > 0 ? { env: this.env } : {}),
			jobs: this.jobs.reduce(
				(acc, root) => {
					let recursive = (factory: GithubJobBuilder<Uses, With>) => {
						const { job, children } = factory.build();
						if (acc[factory.id]) {
							throw new Error(`Job ID collision: ${factory.id}`);
						}
						acc[factory.id] = job;
						children.forEach(recursive);
					};

					recursive(root);
					return acc;
				},
				{} as Record<string, GithubJob<Uses, With>>,
			),
		};
	}
}

export const GithubPipelineX = <
	Uses extends string = string,
	With extends string = string,
>({
	name,
	on,
	children,
	env,
}: {
	name: string;
	on: GithubOn;
	children?: GithubJobBuilder<Uses, With> | GithubJobBuilder<Uses, With>[];
	env?: Record<string, string>;
}): GithubPipelineBuilder<Uses, With> => {
	const factory = new GithubPipelineBuilder<Uses, With>(name);
	if (on.push && (on.push.branches.length ?? 0) > 0) {
		factory.setOnPush(on.push.branches);
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
