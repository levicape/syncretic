import type { GithubTemplateString } from "../../ci/cd/pipeline/github/GithubJobBuilder.mts";
import {
	GithubStepBuilder,
	type GithubStepImageSpec,
	type GithubStepSecretsSpec,
	type GithubStepStrategySpec,
} from "../../ci/cd/pipeline/github/GithubStepBuilder.mts";

export type GithubStepProps<Uses extends string, WithKeys extends string> = {
	name: string;
	with?: Record<WithKeys, GithubTemplateString | undefined>;
	id?: string;
	env?: Record<string, GithubTemplateString | undefined>;
	if?: GithubTemplateString;
	continueOnError?: boolean;
	workingDirectory?: GithubTemplateString;
	shell?: "bash" | "pwsh" | "python" | "sh" | "cmd" | `${string} ${string} {0}`;
	timeoutMinutes?: number;
	strategy?: GithubStepStrategySpec;
	container?: GithubStepImageSpec;
	services?: Record<string, GithubStepImageSpec>;
	secrets?: GithubStepSecretsSpec;
} & ({ uses: Uses; run?: string[] } | { uses?: never; run: string[] });

export const GithubStep = <Uses extends string, WithKeys extends string>(
	props: GithubStepProps<Uses, WithKeys>,
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
	if (props.shell) factory.setShell(props.shell);
	if (props.timeoutMinutes) factory.setTimeoutMinutes(props.timeoutMinutes);
	if (props.strategy) factory.setStrategy(props.strategy);
	if (props.container) factory.setContainer(props.container);
	if (props.services) factory.setServices(props.services);
	if (props.secrets) factory.setSecrets(props.secrets);

	return factory;
};
