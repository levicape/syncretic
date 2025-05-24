import type {
	GithubStepBuilder,
	GithubStepSchema,
} from "./GithubStepBuilder.mjs";

export type GithubTemplateString = string;

export type GithubJobDefaultsSpec = {
	run?: {
		"working-directory"?: string;
		shell?: string;
	};
};

export type GithubJobPermissionsSpec = {
	packages?: "read" | "write";
	contents?: "read" | "write";
};

export type GithubJobStrategySpec = {
	"fail-fast"?: boolean;
	"max-parallel"?: number;
	matrix?: {
		include?: Record<string, string>[];
		exclude?: Record<string, string>[];
	} & { [variable: string]: string[] };
};

export type GithubJobImageSpec = {
	image: string;
	credentials?: {
		username: string;
		password: string;
	};
	options?: string;
	env?: Record<string, string>;
	ports?: string[];
	volumes?: string[];
};

export type GithubJobSecretsSpec =
	| {
			[secret: string]: string;
	  }
	| "inherit";

export type GithubJobSchema<Uses extends string, With extends string> = {
	name: string;
	"runs-on"?: string;
	permissions?: GithubJobPermissionsSpec;
	steps?: GithubStepSchema<Uses, With>[];
	needs?: string[];
	if?: string;
	environment?: string;
	concurrency?: number;
	env?: Record<string, string>;
	defaults?: GithubJobDefaultsSpec;
	strategy?: GithubJobStrategySpec;
	"continue-on-error"?: string;
	container?: GithubJobImageSpec;
	services?: Record<string, GithubJobImageSpec>;
	outputs?: Record<string, GithubTemplateString>;
	uses?: Uses;
	with?: Record<With | never, GithubTemplateString | undefined>;
	secrets?: GithubJobSecretsSpec;
};

export class GithubJobBuilder<Uses extends string, With extends string> {
	public static defaultRunsOn = () => "ubuntu-latest" as const;
	private children: GithubJobBuilder<Uses, With>[] = [];
	private steps: GithubStepBuilder<Uses, With>[] = [];
	private needs: string[] = [];
	private runsOn: string;
	private permissions: {
		packages?: "read" | "write";
		contents?: "read" | "write";
	} = {};
	private if_?: string;
	private outputs: Record<string, string> = {};
	private environment?: string;
	private concurrency?: number;
	private env: Record<string, string> = {};
	private defaults: GithubJobDefaultsSpec = {};
	private strategy: GithubJobStrategySpec = {};
	private "continue-on-error"?: string;
	private container?: GithubJobImageSpec;
	private services: Record<string, GithubJobImageSpec> = {};
	private uses?: Uses;
	private with_: Record<With | never, GithubTemplateString | undefined> =
		{} as Record<With | never, GithubTemplateString | undefined>;
	private secrets?: GithubJobSecretsSpec;

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

	setIf(if_: string): this {
		this.if_ = if_;
		return this;
	}

	setOutputs(outputs: Record<string, string>): this {
		this.outputs = outputs;
		return this;
	}

	setChildren(jobs: GithubJobBuilder<Uses, With>[]): this {
		this.children = jobs;
		return this;
	}

	setPermissions(permissions: {
		packages?: "read" | "write";
		contents?: "read" | "write";
	}): this {
		this.permissions = permissions;
		return this;
	}

	setEnvironment(environment: string): this {
		this.environment = environment;
		return this;
	}

	setConcurrency(concurrency: number): this {
		this.concurrency = concurrency;
		return this;
	}

	setEnv(env: Record<string, string>): this {
		this.env = env;
		return this;
	}

	setDefaults(defaults: GithubJobDefaultsSpec): this {
		this.defaults = defaults;
		return this;
	}

	setStrategy(strategy: GithubJobStrategySpec): this {
		this.strategy = strategy;
		return this;
	}

	setContinueOnError(continueOnError: string): this {
		this["continue-on-error"] = continueOnError;
		return this;
	}

	setContainer(container: GithubJobImageSpec): this {
		this.container = container;
		return this;
	}

	setServices(services: Record<string, GithubJobImageSpec>): this {
		this.services = services;
		return this;
	}

	setUses(uses: Uses): this {
		this.uses = uses;
		return this;
	}

	setWith(with_: Record<With | never, GithubTemplateString | undefined>): this {
		this.with_ = with_;
		return this;
	}

	setSecrets(secrets: GithubJobSecretsSpec): this {
		this.secrets = secrets;
		return this;
	}

	build(): {
		job: GithubJobSchema<Uses, With>;
		children: GithubJobBuilder<Uses, With>[];
	} {
		if (!Array.isArray(this.steps)) {
			this.steps = [this.steps];
		}

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
				if: this.if_,
				name: this.name,
				"runs-on": this.runsOn,
				needs: this.needs.length > 0 ? this.needs : undefined,
				concurrency: this.concurrency,
				"continue-on-error": this["continue-on-error"],
				strategy:
					Object.keys(this.strategy).length > 0 ? this.strategy : undefined,
				uses: (this.uses?.length ?? 0) > 0 ? this.uses : undefined,
				secrets:
					Object.keys(this.secrets ?? {}).length > 0 ? this.secrets : undefined,
				with: Object.keys(this.with_ ?? {}).length > 0 ? this.with_ : undefined,
				permissions:
					Object.keys(this.permissions).length > 0
						? this.permissions
						: undefined,
				outputs:
					Object.keys(this.outputs).length > 0 ? this.outputs : undefined,
				defaults:
					Object.keys(this.defaults).length > 0 ? this.defaults : undefined,
				environment:
					(this.environment?.length ?? 0) > 0 ? this.environment : undefined,
				container: this.container,
				services:
					Object.keys(this.services ?? {}).length > 0
						? this.services
						: undefined,
				env: Object.keys(this.env).length > 0 ? this.env : undefined,
				steps: this.steps.flatMap((step) => {
					let steps = [step];
					while (steps.some((s) => Array.isArray(s))) {
						steps = steps.flat();
					}

					return steps.map((s) => s.build());
				}),
			},
			children: this.children,
		};
	}
}
