import VError from "verror";
import { CodeCatalystActionBuilder } from "../../../../ci/cd/pipeline/codecatalyst/CodeCatalystActionBuilder.mts";
import type { CodeCatalystGithubActionsRunnerSchema } from "../../../../ci/cd/pipeline/codecatalyst/actions/aws/CodeCatalystGithubActionsRunner.mts";
import type { GithubStepBuilder } from "../../../../ci/cd/pipeline/github/GithubStepBuilder.mts";

export type CodeCatalystGithubActionsRunnerProps<
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource";
		Artifacts: string;
		Variables: string;
	},
	Output extends {
		Artifacts: string;
		Variables: string;
	},
> = {
	dependsOn?: DependsOn[];
	steps: GithubStepBuilder<string, string>[];
	compute?: CodeCatalystGithubActionsRunnerSchema<
		DependsOn,
		Input,
		Output
	>["Compute"];
	inputs?: CodeCatalystGithubActionsRunnerSchema<
		DependsOn,
		Input,
		Output
	>["Inputs"];
	outputs?: CodeCatalystGithubActionsRunnerSchema<
		DependsOn,
		Input,
		Output
	>["Outputs"];
	caching?: CodeCatalystGithubActionsRunnerSchema<
		DependsOn,
		Input,
		Output
	>["Caching"];
};

export const CodeCatalystFilteredGithubActions = [
	"actions/checkout@v2",
	"actions/cache@v3",
];

export const CodeCatalystGithubActionsRunner = <
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource";
		Artifacts: string;
		Variables: string;
	},
	Output extends {
		Artifacts: string;
		Variables: string;
	},
>(
	props: CodeCatalystGithubActionsRunnerProps<DependsOn, Input, Output>,
): CodeCatalystActionBuilder<
	CodeCatalystGithubActionsRunnerSchema<DependsOn, Input, Output>["Identifier"],
	DependsOn,
	keyof CodeCatalystGithubActionsRunnerSchema<
		DependsOn,
		Input,
		Output
	>["Configuration"],
	Omit<
		CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Configuration"],
		"Steps"
	> & {
		Steps: GithubStepBuilder<string, string>[];
	},
	{
		Compute?: CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Compute"];
		Inputs?: CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Inputs"];
		Outputs?: CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Outputs"];
		DependsOn?: CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["DependsOn"];
		Caching?: CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Caching"];
	}
> => {
	const { dependsOn, steps } = props;
	const factory = new CodeCatalystActionBuilder<
		CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Identifier"],
		DependsOn,
		keyof CodeCatalystGithubActionsRunnerSchema<
			DependsOn,
			Input,
			Output
		>["Configuration"],
		Omit<
			CodeCatalystGithubActionsRunnerSchema<
				DependsOn,
				Input,
				Output
			>["Configuration"],
			"Steps"
		> & {
			Steps: GithubStepBuilder<string, string>[];
		},
		{
			Compute?: CodeCatalystGithubActionsRunnerSchema<
				DependsOn,
				Input,
				Output
			>["Compute"];
			Inputs?: CodeCatalystGithubActionsRunnerSchema<
				DependsOn,
				Input,
				Output
			>["Inputs"];
			Outputs?: CodeCatalystGithubActionsRunnerSchema<
				DependsOn,
				Input,
				Output
			>["Outputs"];
			DependsOn?: CodeCatalystGithubActionsRunnerSchema<
				DependsOn,
				Input,
				Output
			>["DependsOn"];
			Caching?: CodeCatalystGithubActionsRunnerSchema<
				DependsOn,
				Input,
				Output
			>["Caching"];
		}
	>("aws/github-actions-runner@v1", undefined);

	// if (!children || children.length === 0) {
	// 	throw new VError("No steps provided");
	// }

	if (!steps || steps.length === 0) {
		throw new VError("No steps provided");
	}

	factory.setRest({
		Compute: props.compute,
		Inputs: props.inputs ?? {},
		Outputs: props.outputs ?? {},
		Caching: props.caching ?? {},
		DependsOn: dependsOn,
	});

	let computewithsharing = props.compute as unknown as {
		SharedInstance?: boolean;
	};
	if (
		computewithsharing?.SharedInstance &&
		(props.inputs?.Artifacts || (props.inputs?.Artifacts?.length ?? 0) > 0)
	) {
		throw new VError("SharedInstance is not compatible with Inputs.Artifacts");
	}

	factory.setConfiguration({
		Steps: steps
			.flat(Number.MAX_SAFE_INTEGER / 2)
			.map((stepfactory) => {
				const step = stepfactory.build();
				if (step.uses === "actions/checkout@v2") {
					factory.includeWorkflowSource();
				}

				factory.copyEnvsToInputs(step);
				factory.normalizeWithEnv(step);

				if (step.uses === "actions/setup-node@v4") {
					if (step.with?.scope) {
						console.warn({
							CodeCatalystGithubActionsRunner: {
								message: `Verify that ${step.with?.scope} is set up by a previous workflow action.`,
							},
						});
					}
				}

				if (step.uses === "actions/cache@v3") {
					factory.cacheGithubAction(step);
				}

				if (step.env) {
					step.env = undefined;
				}

				factory.deduplicateInputVariables();

				return step;
			})
			.filter((s) => {
				return !CodeCatalystFilteredGithubActions.includes(s.uses ?? "");
			}) as unknown as GithubStepBuilder<string, string>[],
	});

	factory.normalizeInputSecrets();
	return factory;
};
