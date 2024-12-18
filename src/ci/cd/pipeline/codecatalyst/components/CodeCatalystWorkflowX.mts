import type { CodeCatalystActionBuilder } from "../CodeCatalystActionBuilder.mjs";
import type {
	CodeCatalystComputeSpec,
	CodeCatalystTriggersSpec,
} from "../CodeCatalystWorkflowBuilder.mjs";
import { CodeCatalystWorkflowBuilder } from "../CodeCatalystWorkflowBuilder.mjs";

export type CodeCatalystWorkflowXProps<
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

export const CodeCatalystWorkflowX = <
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
}: CodeCatalystWorkflowXProps<
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
