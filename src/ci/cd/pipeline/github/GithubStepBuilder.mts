import type { GithubTemplateString } from "./GithubJobBuilder.mjs";

export type GithubStepImageSpec = {
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

export type GithubStepStrategySpec = {
	"fail-fast"?: boolean;
	"max-parallel"?: number;
	matrix?: {
		include?: Record<string, string>[];
		exclude?: Record<string, string>[];
	} & { [variable: string]: string[] };
};

export type GithubStepSecretsSpec =
	| {
			[secret: string]: string;
	  }
	| "inherit";

export type GithubStepSchema<Uses extends string, WithKeys extends string> = {
	id?: string;
	name?: string;
	uses: Uses;
	with?: Record<WithKeys | never, GithubTemplateString | undefined> & {
		entrypoint?: GithubTemplateString;
		args?: GithubTemplateString;
	};
	env?: Record<string, GithubTemplateString | undefined>;
	run?: string;
	if?: GithubTemplateString;
	"continue-on-error"?: boolean;
	"working-directory"?: GithubTemplateString;
	shell?: "bash" | "pwsh" | "python" | "sh" | "cmd" | `${string} ${string} {0}`;
	"timeout-minutes"?: number;
	strategy?: GithubStepStrategySpec;
	container?: GithubStepImageSpec;
	services?: Record<string, GithubStepImageSpec>;
	secrets?: GithubStepSecretsSpec;
};

export class GithubStepBuilder<Uses extends string, WithKeys extends string> {
	private id?: string;
	private name?: string;
	private uses?: Uses;
	private _with?: Record<WithKeys | never, GithubTemplateString | undefined>;
	private env?: Record<string, GithubTemplateString | undefined>;
	private run?: string[];
	private _if?: GithubTemplateString;
	private "continue-on-error"?: boolean;
	private "working-directory"?: GithubTemplateString;
	private shell?:
		| "bash"
		| "pwsh"
		| "python"
		| "sh"
		| "cmd"
		| `${string} ${string} {0}`;
	private "timeout-minutes"?: number;
	private strategy?: GithubStepStrategySpec;
	private container?: GithubStepImageSpec;
	private services?: Record<string, GithubStepImageSpec>;
	private secrets?: GithubStepSecretsSpec;

	constructor(
		name: string,
		uses?: Uses,
		with_?: Record<WithKeys, GithubTemplateString | undefined>,
	) {
		this.name = name;
		this.uses = uses;
		this._with = with_;
	}

	setId(id: string): this {
		this.id = id;
		return this;
	}

	setUses(uses: Uses): this {
		this.uses = uses;
		return this;
	}

	setWith(with_: Record<string, GithubTemplateString | undefined>): this {
		this._with = with_;
		return this;
	}

	setEnv(env: Record<string, GithubTemplateString | undefined>): this {
		this.env = env;
		return this;
	}

	getRun(): string[] {
		return this.run || [];
	}

	setRun(run: string[]): this {
		this.run = run;
		return this;
	}

	setIf(_if: GithubTemplateString): this {
		this._if = _if;
		return this;
	}

	setContinueOnError(continueOnError: boolean): this {
		this["continue-on-error"] = continueOnError;
		return this;
	}

	setWorkingDirectory(workingDirectory: GithubTemplateString): this {
		this["working-directory"] = workingDirectory;
		return this;
	}

	setShell(
		shell:
			| "bash"
			| "pwsh"
			| "python"
			| "sh"
			| "cmd"
			| `${string} ${string} {0}`,
	): this {
		this.shell = shell;
		return this;
	}

	setTimeoutMinutes(timeoutMinutes: number): this {
		this["timeout-minutes"] = timeoutMinutes;
		return this;
	}

	setStrategy(strategy: GithubStepStrategySpec): this {
		this.strategy = strategy;
		return this;
	}

	setContainer(container: GithubStepImageSpec): this {
		this.container = container;
		return this;
	}

	setServices(services: Record<string, GithubStepImageSpec>): this {
		this.services = services;
		return this;
	}

	setSecrets(secrets: GithubStepSecretsSpec): this {
		this.secrets = secrets;
		return this;
	}

	build(): GithubStepSchema<Uses, WithKeys> {
		return {
			if: this._if,
			id: (this.id?.length ?? 0) > 0 ? this.id : undefined,
			name: this.name,
			"continue-on-error": this["continue-on-error"],
			strategy:
				Object.keys(this.strategy ?? {}).length > 0 ? this.strategy : undefined,
			uses: ((this.uses?.length ?? 0) > 0 ? this.uses : undefined) as Uses,
			secrets:
				Object.keys(this.secrets ?? {}).length > 0 ? this.secrets : undefined,
			with:
				Object.keys(this._with ?? {}).length > 0
					? (this._with as Record<WithKeys, GithubTemplateString | undefined>)
					: undefined,
			"timeout-minutes": this["timeout-minutes"],
			container:
				Object.keys(this.container ?? {}).length > 0
					? this.container
					: undefined,
			services:
				Object.keys(this.services ?? {}).length > 0 ? this.services : undefined,
			"working-directory":
				(this["working-directory"]?.length ?? 0) > 0
					? this["working-directory"]
					: undefined,
			shell: this.shell,
			env: Object.keys(this.env ?? {}).length > 0 ? this.env : undefined,
			run: this.run
				?.map((r) => {
					r = r.trim();
					r = r.endsWith(";") ? r : `${r};`;
					return r;
				})
				.join("\n"),
		};
	}
}
