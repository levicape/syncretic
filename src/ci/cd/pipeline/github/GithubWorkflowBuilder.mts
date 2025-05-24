import VError from "verror";
import type { GithubJobBuilder, GithubJobSchema } from "./GithubJobBuilder.mjs";

type GithubBranchesSpec = {
	branches?: string[];
	"branches-ignore"?: string[];
};

type GithubTagsSpec = {
	tags?: string[];
	"tags-ignore"?: string[];
};

type GithubPathsSpec = {
	paths?: string[];
	"paths-ignore"?: string[];
};

export type GithubPullRequestSpec = GithubBranchesSpec & GithubPathsSpec;

export type GithubOnPushSpec = GithubBranchesSpec &
	GithubTagsSpec &
	GithubPathsSpec;

export type GithubOnReleaseSpec = {
	types: "released"[];
};

export type GithubOnScheduleSpec = Array<{ cron: string }>;

export type GithubOnWorkflowCallSpec = {
	inputs?: Record<
		string,
		{
			description?: string;
			required: boolean;
			default?: string;
			type: "string" | "number" | "boolean";
		}
	>;
	outputs?: Record<
		string,
		{
			description?: string;
			value: string;
		}
	>;
	secrets?: Record<
		string,
		{
			description?: string;
			required: boolean;
		}
	>;
};

export type GithubOnWorkflowRunSpec = GithubBranchesSpec;

export type GithubOnWorkflowDispatchSpec = {
	inputs?: Record<
		string,
		{
			description?: string;
			required: boolean;
			default?: string;
			type: "string" | "number" | "boolean";
		}
	>;
};

export type GithubOn = {
	push?: GithubOnPushSpec;
	release?: GithubOnReleaseSpec;
	pull_request?: GithubPullRequestSpec;
	pull_request_target?: GithubPullRequestSpec;
	schedule?: GithubOnScheduleSpec;
	workflow_call?: GithubOnWorkflowCallSpec;
	workflow_dispatch?: GithubOnWorkflowCallSpec;
};

export type GithubWorkflowPermissions = {
	packages?: "read" | "write";
	contents?: "read" | "write";
	["id-token"]?: "read" | "write";
};

export type GithubWorkflowDefaults = {
	run?: {
		"working-directory"?: string;
		shell?: string;
	};
};

export type GithubWorkflow<Uses extends string, With extends string> = {
	name: string;
	on: GithubOn;
	jobs?: Record<string, GithubJobSchema<Uses, With>>;
	env?: Record<string, string>;
	permissions?: GithubWorkflowPermissions;
	defaults?: GithubWorkflowDefaults;
	concurrency?: number;
};

export class GithubWorkflowBuilder<Uses extends string, With extends string> {
	private jobs: GithubJobBuilder<Uses, With>[] = [];
	private on?: GithubOn;
	private env: Record<string, string> = {};
	private permissions: GithubWorkflowPermissions = {};
	private defaults: GithubWorkflowDefaults = {};
	private concurrency?: number;

	constructor(private name: string) {}

	addJob(job: GithubJobBuilder<Uses, With>): this {
		this.jobs.push(job);
		return this;
	}

	setEnv(env: Record<string, string>): this {
		this.env = env;
		return this;
	}

	setOn(on: GithubOn): this {
		this.on = on;
		return this;
	}

	setConcurrency(concurrency: number): this {
		this.concurrency = concurrency;
		return this;
	}

	setDefaults(defaults: GithubWorkflowDefaults): this {
		this.defaults = defaults;
		return this;
	}

	setPermissions(permissions: GithubWorkflowPermissions): this {
		this.permissions = permissions;
		return this;
	}

	build(): GithubWorkflow<Uses, With> {
		if (!this.jobs.length) {
			throw new VError("No jobs added to workflow");
		}

		if (!this.on) {
			throw new VError("No on added to workflow");
		}

		if (this.on.schedule !== undefined) {
			// Check at least one schedule is defined
			if (!Array.isArray(this.on.schedule) || this.on.schedule.length === 0) {
				throw new VError("Schedule workflows must have at least one element");
			}
			console.warn({
				message: "Schedule workflows are not supported yet",
				on: this.on.schedule,
			});
		}
		return {
			name: this.name,
			on: this.on,
			...(Object.keys(this.defaults).length > 0
				? { defaults: this.defaults }
				: {}),
			...(this.concurrency ? { concurrency: this.concurrency } : {}),
			...(Object.keys(this.permissions).length > 0
				? { permissions: this.permissions }
				: {}),
			...(Object.keys(this.env).length > 0 ? { env: this.env } : {}),
			jobs: this.jobs.reduce(
				(acc, root) => {
					let recursive = (factory: GithubJobBuilder<Uses, With>) => {
						const { job, children } = factory.build();
						if (acc[factory.id]) {
							throw new VError(`Job ID collision: ${factory.id}`);
						}
						acc[factory.id] = job;
						children.forEach(recursive);
					};

					recursive(root);

					let allids = Object.keys(acc);
					let missing = allids.filter((id) =>
						acc[id].needs?.some((need) => !allids.includes(need)),
					);

					if (missing.length) {
						throw new VError("Missing dependencies: %s", missing.join(", "));
					}

					return acc;
				},
				{} as Record<string, GithubJobSchema<Uses, With>>,
			),
		};
	}
}
