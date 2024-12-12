/**
 * @link https://buildkite.com/docs/pipelines/command-step
 */

export type GithubTemplateString = string;

export type GithubStep<Uses extends string, WithKeys extends string> = {
	id?: string;
	name?: string;
	uses: Uses;
	with?: Record<WithKeys | never, GithubTemplateString | undefined>;
	env?: Record<string, GithubTemplateString | undefined>;
	run?: string;
	if?: GithubTemplateString;
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

	build(): GithubStep<Uses, WithKeys> {
		return {
			if: this._if,
			id: this.id,
			name: this.name,
			uses: this.uses as Uses,
			env: this.env,
			with:
				Object.keys(this._with ?? {}).length > 0
					? (this._with as Record<WithKeys, GithubTemplateString | undefined>)
					: undefined,
			"working-directory": this["working-directory"],
			run: this.run
				?.map((r) => {
					r = r.trim();
					r = r.endsWith(";") ? r : `${r};`;
					return r;
				})
				.join("\n"),
			"continue-on-error": this["continue-on-error"],
		};
	}
}

export const GithubStepX = <Uses extends string, WithKeys extends string>(
	props: {
		name: string;
		with?: Record<WithKeys, GithubTemplateString | undefined>;
		id?: string;
		env?: Record<string, GithubTemplateString | undefined>;
		if?: GithubTemplateString;
		continueOnError?: boolean;
		workingDirectory?: GithubTemplateString;
	} & ({ uses: Uses; run?: string[] } | { uses?: never; run: string[] }),
): GithubStepBuilder<Uses, WithKeys> => {
	const { name, uses, with: with_ } = props;
	const factory = new GithubStepBuilder(name, uses, with_);
	if (props.id) factory.setId(props.id);
	if (props.env) factory.setEnv(props.env);
	if (props.run) factory.setRun(props.run);
	if (props.if) factory.setIf(props.if);
	if (props.continueOnError) factory.setContinueOnError(props.continueOnError);
	if (props.workingDirectory)
		factory.setWorkingDirectory(props.workingDirectory);
	return factory;
};
