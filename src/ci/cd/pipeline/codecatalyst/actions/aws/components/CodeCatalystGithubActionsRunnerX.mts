import VError from "verror";
import type { GithubStepBuilder } from "../../../../github/GithubStepBuilder.mjs";
import { CodeCatalystActionBuilder } from "../../../CodeCatalystActionBuilder.mjs";
import type { CodeCatalystGithubActionsRunner } from "../CodeCatalystGithubActionsRunner.mjs";

export type CodeCatalystGithubActionsRunnerXProps<
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
	compute?: CodeCatalystGithubActionsRunner<
		DependsOn,
		Input,
		Output
	>["Compute"];
	inputs?: CodeCatalystGithubActionsRunner<DependsOn, Input, Output>["Inputs"];
	outputs?: CodeCatalystGithubActionsRunner<
		DependsOn,
		Input,
		Output
	>["Outputs"];
	caching?: CodeCatalystGithubActionsRunner<
		DependsOn,
		Input,
		Output
	>["Caching"];
};

export const CodeCatalystFilteredGithubActions = [
	"actions/checkout@v2",
	"actions/cache@v3",
];

export const CodeCatalystGithubActionsRunnerX = <
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
	props: CodeCatalystGithubActionsRunnerXProps<DependsOn, Input, Output>,
): CodeCatalystActionBuilder<
	CodeCatalystGithubActionsRunner<DependsOn, Input, Output>["Identifier"],
	DependsOn,
	keyof CodeCatalystGithubActionsRunner<
		DependsOn,
		Input,
		Output
	>["Configuration"],
	Omit<
		CodeCatalystGithubActionsRunner<DependsOn, Input, Output>["Configuration"],
		"Steps"
	> & {
		Steps: GithubStepBuilder<string, string>[];
	},
	{
		Compute?: CodeCatalystGithubActionsRunner<
			DependsOn,
			Input,
			Output
		>["Compute"];
		Inputs?: CodeCatalystGithubActionsRunner<
			DependsOn,
			Input,
			Output
		>["Inputs"];
		Outputs?: CodeCatalystGithubActionsRunner<
			DependsOn,
			Input,
			Output
		>["Outputs"];
		DependsOn?: CodeCatalystGithubActionsRunner<
			DependsOn,
			Input,
			Output
		>["DependsOn"];
		Caching?: CodeCatalystGithubActionsRunner<
			DependsOn,
			Input,
			Output
		>["Caching"];
	}
> => {
	const { dependsOn, steps } = props;
	const factory = new CodeCatalystActionBuilder<
		CodeCatalystGithubActionsRunner<DependsOn, Input, Output>["Identifier"],
		DependsOn,
		keyof CodeCatalystGithubActionsRunner<
			DependsOn,
			Input,
			Output
		>["Configuration"],
		Omit<
			CodeCatalystGithubActionsRunner<
				DependsOn,
				Input,
				Output
			>["Configuration"],
			"Steps"
		> & {
			Steps: GithubStepBuilder<string, string>[];
		},
		{
			Compute?: CodeCatalystGithubActionsRunner<
				DependsOn,
				Input,
				Output
			>["Compute"];
			Inputs?: CodeCatalystGithubActionsRunner<
				DependsOn,
				Input,
				Output
			>["Inputs"];
			Outputs?: CodeCatalystGithubActionsRunner<
				DependsOn,
				Input,
				Output
			>["Outputs"];
			DependsOn?: CodeCatalystGithubActionsRunner<
				DependsOn,
				Input,
				Output
			>["DependsOn"];
			Caching?: CodeCatalystGithubActionsRunner<
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
							CodeCatalystGithubActionsRunnerX: {
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
