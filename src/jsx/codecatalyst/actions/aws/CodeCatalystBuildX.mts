import VError from "verror";
import { CodeCatalystActionBuilder } from "../../../../ci/cd/pipeline/codecatalyst/CodeCatalystActionBuilder.mjs";
import type { CodeCatalystStepBuilder } from "../../../../ci/cd/pipeline/codecatalyst/CodeCatalystStepBuilder.mjs";
import type { CodeCatalystBuildAction } from "../../../../ci/cd/pipeline/codecatalyst/actions/aws/CodeCatalystBuildAction.mjs";
import {
	CodeCatalystLinux86,
	CodeCatalystLinuxA64,
} from "../../../../ci/cd/pipeline/codecatalyst/actions/aws/CodeCatalystTestAction.mjs";

export type CodeCatalystBuildXConfiguration<
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
	timeout?: CodeCatalystBuildAction<DependsOn, Input, Output>["Timeout"];
	caching?: CodeCatalystBuildAction<DependsOn, Input, Output>["Caching"];
	container?: CodeCatalystBuildAction<
		DependsOn,
		Input,
		Output
	>["Configuration"]["Container"];
	environment?: NonNullable<
		CodeCatalystBuildAction<DependsOn, Input, Output>["Environment"]
	>["Name"];
};

export type CodeCatalystBuildXProps<
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
	dependsOn?: NoInfer<DependsOn>[];
	configuration?: Omit<
		CodeCatalystBuildXConfiguration<DependsOn, Input, Output>,
		"Steps"
	>;
	steps: CodeCatalystStepBuilder[];
	compute?: CodeCatalystBuildAction<DependsOn, Input, Output>["Compute"];
	inputs?: CodeCatalystBuildAction<DependsOn, Input, Output>["Inputs"];
	outputs?: CodeCatalystBuildAction<DependsOn, Input, Output>["Outputs"];
	packages?: CodeCatalystBuildAction<DependsOn, Input, Output>["Packages"];
	caching?: CodeCatalystBuildAction<DependsOn, Input, Output>["Caching"];
	timeout?: CodeCatalystBuildAction<DependsOn, Input, Output>["Timeout"];
	environment?: CodeCatalystBuildAction<
		DependsOn,
		Input,
		Output
	>["Environment"];
};

export const CodeCatalystBuildX = <
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
	props: CodeCatalystBuildXProps<DependsOn, Input, Output>,
): CodeCatalystActionBuilder<
	CodeCatalystBuildAction<DependsOn, Input, Output>["Identifier"],
	DependsOn,
	keyof CodeCatalystBuildAction<DependsOn, Input, Output>["Configuration"],
	Omit<
		CodeCatalystBuildAction<DependsOn, Input, Output>["Configuration"],
		"Steps"
	> & {
		Steps: CodeCatalystStepBuilder[];
	},
	{
		Compute?: CodeCatalystBuildAction<DependsOn, Input, Output>["Compute"];
		Inputs?: CodeCatalystBuildAction<DependsOn, Input, Output>["Inputs"];
		Outputs?: CodeCatalystBuildAction<DependsOn, Input, Output>["Outputs"];
		Packages?: CodeCatalystBuildAction<DependsOn, Input, Output>["Packages"];
		DependsOn?: CodeCatalystBuildAction<DependsOn, Input, Output>["DependsOn"];
		Timeout?: CodeCatalystBuildAction<DependsOn, Input, Output>["Timeout"];
		Caching?: CodeCatalystBuildAction<DependsOn, Input, Output>["Caching"];
		Environment?: CodeCatalystBuildAction<
			DependsOn,
			Input,
			Output
		>["Environment"];
	}
> => {
	const { dependsOn, configuration, steps } = props;
	const factory = new CodeCatalystActionBuilder<
		CodeCatalystBuildAction<DependsOn, Input, Output>["Identifier"],
		DependsOn,
		keyof CodeCatalystBuildAction<DependsOn, Input, Output>["Configuration"],
		Omit<
			CodeCatalystBuildAction<DependsOn, Input, Output>["Configuration"],
			"Steps"
		> & {
			Steps: CodeCatalystStepBuilder[];
		},
		{
			Compute?: CodeCatalystBuildAction<DependsOn, Input, Output>["Compute"];
			Inputs?: CodeCatalystBuildAction<DependsOn, Input, Output>["Inputs"];
			Outputs?: CodeCatalystBuildAction<DependsOn, Input, Output>["Outputs"];
			Packages?: CodeCatalystBuildAction<DependsOn, Input, Output>["Packages"];
			DependsOn?: CodeCatalystBuildAction<
				DependsOn,
				Input,
				Output
			>["DependsOn"];
			Timeout?: CodeCatalystBuildAction<DependsOn, Input, Output>["Timeout"];
			Caching?: CodeCatalystBuildAction<DependsOn, Input, Output>["Caching"];
			Environment?: CodeCatalystBuildAction<
				DependsOn,
				Input,
				Output
			>["Environment"];
		}
	>("aws/build@v1.0.0", undefined);

	// if (!children || children.length === 0) {
	// 	throw new VError("CodeCatalystBuildX: Children are required");
	// }
	if (!steps || steps.length === 0) {
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
			? steps.flatMap((step) =>
					Array.isArray(step) ? step.flatMap((s) => s.build()) : step.build(),
				)
			: [
					(steps as CodeCatalystStepBuilder)?.build(),
				]) as unknown as CodeCatalystStepBuilder[],
	});

	if (dependsOn && dependsOn.length > 0) {
		if (dependsOn.includes(factory.getId() as DependsOn)) {
			throw new VError("CodeCatalystBuildX: Circular dependency detected");
		}
	}

	factory.setRest({
		DependsOn: dependsOn,
		Timeout: props?.timeout,
		Environment: props.environment,
		Caching: props?.caching,
		Compute: props.compute,
		Inputs: props.inputs,
		Outputs: props.outputs,
		Packages: props.packages,
	});

	return factory;
};
