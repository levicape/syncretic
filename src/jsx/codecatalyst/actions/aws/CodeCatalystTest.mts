import VError from "verror";
import { CodeCatalystActionBuilder } from "../../../../ci/cd/pipeline/codecatalyst/CodeCatalystActionBuilder.mts";
import type { CodeCatalystStepBuilder } from "../../../../ci/cd/pipeline/codecatalyst/CodeCatalystStepBuilder.mts";
import {
	CodeCatalystLinux86,
	CodeCatalystLinuxA64,
	type CodeCatalystTestAction,
} from "../../../../ci/cd/pipeline/codecatalyst/actions/aws/CodeCatalystTestAction.mts";
export type CodeCatalystTestConfiguration<
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource"[];
		Artifacts: string[];
		Variables: {
			Name: string;
			Value: string;
		}[];
	},
	Output extends {
		Artifacts: {
			Name: string;
			Files: string[];
		}[];
		Variables: string[];
	},
> = {
	timeout?: CodeCatalystTestAction<DependsOn, Input, Output>["Timeout"];
	container?: CodeCatalystTestAction<
		DependsOn,
		Input,
		Output
	>["Configuration"]["Container"];
	caching?: CodeCatalystTestAction<DependsOn, Input, Output>["Caching"];
};

export type CodeCatalystTestProps<
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource"[];
		Artifacts: string[];
		Variables: {
			Name: string;
			Value: string;
		}[];
	},
	Output extends {
		Artifacts: {
			Name: string;
			Files: string[];
		}[];
		Variables: string[];
	},
> = {
	architecture?: "arm64" | "x86";
	dependsOn?: DependsOn[];
	configuration?: Omit<
		CodeCatalystTestConfiguration<DependsOn, Input, Output>,
		"Steps"
	>;
	steps: CodeCatalystStepBuilder[] | CodeCatalystStepBuilder;
	compute?: CodeCatalystTestAction<DependsOn, Input, Output>["Compute"];
	inputs?: CodeCatalystTestAction<DependsOn, Input, Output>["Inputs"];
	outputs?: CodeCatalystTestAction<DependsOn, Input, Output>["Outputs"];
	packages?: CodeCatalystTestAction<DependsOn, Input, Output>["Packages"];
	timeout?: CodeCatalystTestAction<DependsOn, Input, Output>["Timeout"];
	caching?: CodeCatalystTestAction<DependsOn, Input, Output>["Caching"];
};

export const CodeCatalystTest = <
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource"[];
		Artifacts: string[];
		Variables: {
			Name: string;
			Value: string;
		}[];
	},
	Output extends {
		Artifacts: {
			Name: string;
			Files: string[];
		}[];
		Variables: string[];
	},
>(
	props: CodeCatalystTestProps<DependsOn, Input, Output>,
): CodeCatalystActionBuilder<
	CodeCatalystTestAction<DependsOn, Input, Output>["Identifier"],
	DependsOn,
	keyof CodeCatalystTestAction<DependsOn, Input, Output>["Configuration"],
	Omit<
		CodeCatalystTestAction<DependsOn, Input, Output>["Configuration"],
		"Steps"
	> & {
		Steps: CodeCatalystStepBuilder[];
	},
	{
		Compute?: CodeCatalystTestAction<DependsOn, Input, Output>["Compute"];
		Inputs?: CodeCatalystTestAction<DependsOn, Input, Output>["Inputs"];
		Outputs?: CodeCatalystTestAction<DependsOn, Input, Output>["Outputs"];
		Packages?: CodeCatalystTestAction<DependsOn, Input, Output>["Packages"];
		DependsOn?: CodeCatalystTestAction<DependsOn, Input, Output>["DependsOn"];
		Timeout?: CodeCatalystTestAction<DependsOn, Input, Output>["Timeout"];
		Caching?: CodeCatalystTestAction<DependsOn, Input, Output>["Caching"];
	}
> => {
	const { dependsOn, configuration, steps } = props;
	const factory = new CodeCatalystActionBuilder<
		CodeCatalystTestAction<DependsOn, Input, Output>["Identifier"],
		DependsOn,
		keyof CodeCatalystTestAction<DependsOn, Input, Output>["Configuration"],
		Omit<
			CodeCatalystTestAction<DependsOn, Input, Output>["Configuration"],
			"Steps"
		> & {
			Steps: CodeCatalystStepBuilder[];
		},
		{
			Compute?: CodeCatalystTestAction<DependsOn, Input, Output>["Compute"];
			Inputs?: CodeCatalystTestAction<DependsOn, Input, Output>["Inputs"];
			Outputs?: CodeCatalystTestAction<DependsOn, Input, Output>["Outputs"];
			Packages?: CodeCatalystTestAction<DependsOn, Input, Output>["Packages"];
			DependsOn?: CodeCatalystTestAction<DependsOn, Input, Output>["DependsOn"];
			Timeout?: CodeCatalystTestAction<DependsOn, Input, Output>["Timeout"];
			Caching?: CodeCatalystTestAction<DependsOn, Input, Output>["Caching"];
		}
	>("aws/managed-test@v1.0.0", undefined);

	// if (!children || children.length === 0) {
	// 	throw new VError("No steps provided");
	// }

	if (!steps || Array.isArray(steps) ? steps.length === 0 : false) {
		throw new VError("No steps provided");
	}

	factory.setConfiguration({
		Container: configuration?.container ?? {
			Registry: "CODECATALYST",
			Image:
				props.architecture === "arm64"
					? CodeCatalystLinuxA64
					: CodeCatalystLinux86,
		},
		Steps: (Array.isArray(steps)
			? steps.map((step) => step.build())
			: [steps.build()]) as unknown as CodeCatalystStepBuilder[],
	});

	if (dependsOn && dependsOn.length > 0) {
		if (dependsOn.includes(factory.getId() as DependsOn)) {
			throw new VError("CodeCatalystBuildX: Circular dependency detected");
		}
	}

	factory.setRest({
		Timeout: props.timeout,
		Caching: props.caching,
		Compute: props.compute,
		DependsOn: dependsOn,
		Inputs: props.inputs,
		Outputs: props.outputs,
		Packages: props.packages,
	});

	return factory;
};
