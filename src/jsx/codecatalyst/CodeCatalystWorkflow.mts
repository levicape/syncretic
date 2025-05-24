import type { CodeCatalystActionBuilder } from "../../ci/cd/pipeline/codecatalyst/CodeCatalystActionBuilder.mts";
import {
	type CodeCatalystComputeSpec,
	type CodeCatalystTriggersSpec,
	CodeCatalystWorkflowBuilder,
} from "../../ci/cd/pipeline/codecatalyst/CodeCatalystWorkflowBuilder.mts";

export type CodeCatalystWorkflowProps<
	Identifiers extends string,
	With extends string,
	DependsOn extends string,
> = {
	name: string;
	runMode?: "QUEUED" | "SUPERSEDED" | "PARALLEL";
	compute: CodeCatalystComputeSpec;
	triggers: CodeCatalystTriggersSpec[];
	children?: Record<
		DependsOn,
		CodeCatalystActionBuilder<
			Identifiers,
			DependsOn,
			With,
			Partial<Record<string, unknown>>,
			Partial<Record<string, unknown>>
		>
	>;
};

export const CodeCatalystWorkflow = <
	Identifiers extends string,
	With extends string,
	DependsOn extends string,
	Inputs extends {
		Sources: string | "WorkflowSource"[];
		Artifacts: string[];
		Variables: {
			Name: string;
			Value: string;
		}[];
	},
	Outputs extends {
		Artifacts: {
			Name: string;
			Files: string[];
		}[];
		Variables: string[];
	},
>({
	name,
	runMode,
	compute,
	triggers,
	children,
}: CodeCatalystWorkflowProps<
	Identifiers,
	With,
	DependsOn
>): CodeCatalystWorkflowBuilder<
	Identifiers,
	With,
	DependsOn,
	Inputs,
	Outputs
> => {
	const factory = new CodeCatalystWorkflowBuilder<
		Identifiers,
		With,
		DependsOn,
		Inputs,
		Outputs
	>(name);

	if (runMode) {
		factory.setRunMode(runMode);
	}

	factory.setCompute(compute);
	// Todo Add fleet type to context,
	// check for arm64 compatibility in action builders

	triggers.forEach((trigger) => {
		factory.addTrigger(trigger);
	});

	if (children) {
		for (const [name, action] of Object.entries(children) as [
			string,
			CodeCatalystActionBuilder<
				Identifiers,
				DependsOn,
				string,
				Partial<Record<string, unknown>>,
				Partial<Record<string, unknown>>
			>,
		][]) {
			if ("actions" in action) {
				let group = action as unknown as {
					$id: string;
					dependsOn: DependsOn[];
					actions: CodeCatalystActionBuilder<
						Identifiers,
						DependsOn,
						string,
						Partial<Record<string, unknown>>,
						Partial<Record<string, unknown>>
					>[];
				};
				group.$id = name;
				factory.addAction(group);
			} else {
				action.setId(name);
				factory.addAction(action);
			}
		}
	}

	return factory;
};

export * from "../../ci/cd/pipeline/codecatalyst/CodeCatalystWorkflowBuilder.mts";
export * from "../../ci/cd/pipeline/codecatalyst/CodeCatalystWorkflowExpressions.mts";
export * from "./actions/aws/CodeCatalystApproval.mts";
export * from "./actions/aws/CodeCatalystBuild.mts";
export * from "./actions/aws/CodeCatalystGithubActionsRunner.mts";
export * from "./actions/aws/CodeCatalystTest.mts";
export * from "./CodeCatalystActionGroup.mts";
export * from "./CodeCatalystStep.mts";
