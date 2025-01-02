import VError from "verror";
import type {
	CodePipelineArtifactStore,
	CodePipelineArtifactStoreBuilder,
} from "./CodePipelineArtifactStore.mjs";
import type {
	CodePipelineStage,
	CodePipelineStageBuilder,
} from "./CodePipelineStage.mjs";
import type {
	CodePipelineTrigger,
	CodePipelineTriggerBuilder,
} from "./CodePipelineTrigger.mjs";
import type {
	CodePipelineVariable,
	CodePipelineVariableBuilder,
} from "./CodePipelineVariable.mjs";

export type Region = string;

export type CodePipelineDefinitionExecutionModeSpec =
	| "PARALLEL"
	| "SUPERSEDED"
	| "QUEUED";
export type CodePipelineDefinitionPipelineTypeSpec = "V2";

export type CodePipelineDefinition = {
	name: string;
	executionMode: CodePipelineDefinitionExecutionModeSpec;
	pipelineType: CodePipelineDefinitionPipelineTypeSpec;
	roleArn: string;
	triggers?: CodePipelineTrigger[];
	variables?: CodePipelineVariable[];
	stages: CodePipelineStage[];
} & (
	| {
			artifactStore: CodePipelineArtifactStore;
			artifactStores?: never;
	  }
	| {
			artifactStore?: never;
			artifactStores: Record<Region, CodePipelineArtifactStore>;
	  }
);

export class CodePipelineDefinitionBuilder {
	private name: string;
	private executionMode: "PARALLEL" | "SUPERSEDED" | "QUEUED" = "SUPERSEDED";
	private roleArn: string;
	private triggers: CodePipelineTriggerBuilder[] = [];
	private variables: CodePipelineVariableBuilder[] = [];
	private artifactStores: CodePipelineArtifactStoreBuilder[] = [];
	private stages: CodePipelineStageBuilder[] = [];

	constructor(name: string) {
		this.name = name;
	}

	setExecutionMode(executionMode: "PARALLEL" | "SUPERSEDED" | "QUEUED"): this {
		this.executionMode = executionMode;
		return this;
	}

	setRoleArn(roleArn: string): this {
		this.roleArn = roleArn;
		return this;
	}

	addTrigger(trigger: CodePipelineTriggerBuilder): this {
		this.triggers.push(trigger);
		return this;
	}

	setTriggers(triggers: CodePipelineTriggerBuilder[]): this {
		this.triggers = triggers;
		return this;
	}

	addVariable(variable: CodePipelineVariableBuilder): this {
		this.variables.push(variable);
		return this;
	}

	setVariables(variables: CodePipelineVariableBuilder[]): this {
		this.variables = variables;
		return this;
	}

	addStage(stage: CodePipelineStageBuilder): this {
		this.stages.push(stage);
		return this;
	}

	setStages(stages: CodePipelineStageBuilder[]): this {
		this.stages = stages;
		return this;
	}

	addArtifactStore(artifactStore: CodePipelineArtifactStoreBuilder): this {
		this.artifactStores.push(artifactStore);
		return this;
	}

	setArtifactStores(artifactStores: CodePipelineArtifactStoreBuilder[]): this {
		this.artifactStores = artifactStores;
		return this;
	}

	build(): CodePipelineDefinition {
		if (
			this.artifactStores.length > 1 &&
			this.artifactStores.some((as) => !as.getRegion())
		) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { artifactStores: this.artifactStores },
				},
				"All artifact stores must have regions defined when multiple artifact stores are defined",
			);
		}

		if (this.stages.length === 0) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { stages: this.stages },
				},
				"At least one stage must be defined",
			);
		}

		if (this.stages[0].getActions().length === 0) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { stages: this.stages },
				},
				"First stage must have at least one action",
			);
		}

		if (
			this.stages[0].getActions()[0]?.getActionTypeId().category !== "Source" &&
			this.triggers.length !== 0
		) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { stages: this.stages },
				},
				"First stage, first action must have a Source action first if using triggers",
			);
		}

		let artifacts =
			this.artifactStores.length === 1
				? {
						artifactStore: this.artifactStores[0].build(),
					}
				: {
						artifactStores: this.artifactStores.reduce(
							(acc, as) => {
								acc[as.getRegion()!] = as.build();
								return acc;
							},
							{} as Record<Region, CodePipelineArtifactStore>,
						),
					};

		if (this.artifactStores.length === 0) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { artifactStores: this.artifactStores },
				},
				"An artifact store must be defined",
			);
		}

		if (this.triggers.length > 50) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { triggers: this.triggers },
				},
				"Maximum of 50 triggers allowed",
			);
		}

		if (this.variables.length > 50) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_DEFINITION",
					info: { variables: this.variables },
				},
				"Maximum of 50 variables allowed",
			);
		}

		const triggers =
			this.triggers.length > 0
				? {
						triggers: this.triggers.map((t) => t.build()),
					}
				: {};

		const variables =
			this.variables.length > 0
				? {
						variables: this.variables.map((v) => v.build()),
					}
				: {};

		return {
			pipelineType: "V2",
			executionMode: this.executionMode,
			name: this.name,
			roleArn: this.roleArn,
			...artifacts,
			...triggers,
			...variables,
			stages: this.stages.map((s) => s.build()),
		};
	}
}
