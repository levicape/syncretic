/**
 * @link https://buildkite.com/docs/pipelines/command-step
 */

export type GithubTemplateString = string;

export type GithubStep<Uses extends string, WithKeys extends string> = {
	id?: string;
	name?: string;
	uses: Uses;
	_with?: Record<WithKeys | never, GithubTemplateString | undefined>;
	env?: Record<string, GithubTemplateString | undefined>;
	run?: string;
	_if?: GithubTemplateString;
	"continue-on-error"?: boolean;
	"working-directory"?: GithubTemplateString;
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

	constructor(
		name: string,
		uses: Uses,
		with_: Record<WithKeys, GithubTemplateString | undefined>,
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

	build(): GithubStep<Uses, WithKeys> {
		return {
			id: this.id,
			name: this.name,
			uses: this.uses as Uses,
			_with: this._with as Record<WithKeys, GithubTemplateString | undefined>,
			env: this.env,
			run: this.run
				?.map((r) => {
					r = r.trim();
					r = r.endsWith(";") ? r : `${r};`;
				})
				.join("\n"),
			_if: this._if,
			"continue-on-error": this["continue-on-error"],
			"working-directory": this["working-directory"],
		};
	}
}
