import VError from "verror";
import type {
	CodeCatalystAction,
	CodeCatalystActionBuilder,
	CodeCatalystActions,
} from "./CodeCatalystActionBuilder.mjs";
import type { CodeCatalystComputeEc2Spec } from "./compute/CodeCatalystComputeEc2.mjs";
import type { CodeCatalystComputeLambdaSpec } from "./compute/CodeCatalystComputeLambda.mjs";
import type { CodeCatalystPullrequestTriggerSpec } from "./triggers/CodeCatalystPullrequestTrigger.mjs";
import type { CodeCatalystPushTriggerSpec } from "./triggers/CodeCatalystPushTrigger.mjs";
import type { CodeCatalystScheduleTriggerSpec } from "./triggers/CodeCatalystScheduleTrigger.mjs";

export type CodeCatalystComputeSpec =
	| CodeCatalystComputeEc2Spec
	| CodeCatalystComputeLambdaSpec;

export type CodeCatalystTriggersSpec =
	| CodeCatalystPushTriggerSpec
	| CodeCatalystPullrequestTriggerSpec
	| CodeCatalystScheduleTriggerSpec;

const AlphanumericUnderscoreRegex = /^[a-zA-Z0-9_-]+$/;
export type CodeCatalystWorkflow<
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
> = {
	Name: string;
	RunMode: "QUEUED" | "SUPERSEDED" | "PARALLEL";
	SchemaVersion: "1.0";
	Compute: CodeCatalystComputeSpec;
	Triggers: CodeCatalystTriggersSpec[];
	Actions?: Record<DependsOn, CodeCatalystActions<DependsOn, Inputs, Outputs>>;
};

export class CodeCatalystWorkflowBuilder<
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
> {
	private runMode: "QUEUED" | "SUPERSEDED" | "PARALLEL" = "QUEUED";
	private compute: CodeCatalystComputeSpec;
	private triggers: CodeCatalystTriggersSpec[] = [];
	private actions: (
		| CodeCatalystActionBuilder<
				Identifiers,
				DependsOn,
				string,
				Partial<Record<string, unknown>>,
				Partial<Record<string, unknown>>
		  >
		| {
				$id: string;
				actions: CodeCatalystActionBuilder<
					Identifiers,
					DependsOn,
					string,
					Partial<Record<string, unknown>>,
					Partial<Record<string, unknown>>
				>[];
		  }
	)[] = [];

	constructor(private name: string) {}

	setRunMode(runMode: "QUEUED" | "SUPERSEDED" | "PARALLEL"): this {
		this.runMode = runMode;
		return this;
	}

	setCompute(compute: CodeCatalystComputeSpec): this {
		this.compute = compute;
		let withSharedInstance = compute as {
			SharedInstance?: string;
		};

		if (typeof withSharedInstance.SharedInstance === "boolean") {
			withSharedInstance.SharedInstance = withSharedInstance.SharedInstance
				? "TRUE"
				: "FALSE";
		}
		return this;
	}

	addTrigger(trigger: CodeCatalystTriggersSpec): this {
		this.triggers.push(trigger);
		return this;
	}

	addAction(action: (typeof this.actions)[number]): this {
		this.actions.push(action);
		return this;
	}

	build(): CodeCatalystWorkflow<DependsOn, Inputs, Outputs> {
		if (!AlphanumericUnderscoreRegex.test(this.name)) {
			throw new VError(
				"Invalid workflow name: %s. Workflow names must match /[A-Za-z0-9_-]+/",
				this.name,
			);
		}

		if (this.name.length > 100) {
			throw new VError(
				"Workflow name too long: %s. Workflow names must be less than 100 characters",
				this.name,
			);
		}

		if (!this.actions.length) {
			throw new VError("No actions added to workflow");
		}

		const workflow = {
			Name: this.name,
			RunMode: this.runMode,
			SchemaVersion: "1.0",
			Compute: { ...this.compute },
			Triggers: this.triggers,
			Actions: this.actions.reduce(
				(acc, root) => {
					let recursive = (
						factory:
							| CodeCatalystActionBuilder<
									string,
									DependsOn,
									With,
									Partial<Record<string, unknown>>,
									Partial<Record<string, unknown>>
							  >
							| {
									$id: string;
									actions: CodeCatalystActionBuilder<
										Identifiers,
										DependsOn,
										string,
										Partial<Record<string, unknown>>,
										Partial<Record<string, unknown>>
									>[];
							  },
					) => {
						if ("$id" in factory) {
							const { $id, actions, dependsOn } = factory as {
								$id: string;
								dependsOn?: DependsOn[];
								actions: CodeCatalystActionBuilder<
									Identifiers,
									DependsOn,
									string,
									Partial<Record<string, unknown>>,
									Partial<Record<string, unknown>>
								>[];
							};
							if (acc[$id]) {
								throw new VError(`Action ID collision: ${$id}`);
							}

							acc[$id] = actions.reduce(
								(gacc, action) => {
									const id = action.getId();
									if (id === undefined) {
										throw new VError("Action ID not set");
									}
									const { job, children } = action.build();
									if (gacc.Actions[id]) {
										throw new VError(`Action ID collision: ${id}`);
									}
									if (acc[id]) {
										throw new VError(`Action ID collision: ${id}`);
									}

									gacc.Actions[id] = job;

									children.forEach(recursive);
									return gacc;
								},

								// This builds each action YAML
								{
									...(dependsOn ? { DependsOn: dependsOn } : {}),
									Actions: {},
								} as Record<
									string,
									// biome-ignore lint/suspicious/noExplicitAny:
									CodeCatalystAction<string, string, any, any>
								>,
							);
							return;
						}

						const { job, children } = factory.build();
						let id = factory.getId();
						if (id === undefined) {
							throw new VError("Action ID not set");
						}

						if (acc[id]) {
							throw new VError(`Job ID collision: ${id}`);
						}

						acc[id] = job;
						children.forEach(recursive);
					};

					recursive(root);

					let nestedids = Object.keys(acc).flatMap((id) => {
						const { Actions } = acc[id];
						return Object.keys(Actions || {});
					});
					let allids = [...Object.keys(acc), ...nestedids];
					let invalid = allids.filter(
						(id) => !AlphanumericUnderscoreRegex.test(id),
					);
					if (invalid.length) {
						throw new VError(
							"Invalid action ID(s): %s. Action IDs must match /[A-Za-z0-9_-]+/",
							invalid.join(", "),
						);
					}

					let checkMissing = (
						node: Record<
							string,
							| {
									Actions: Record<
										string,
										// biome-ignore lint/suspicious/noExplicitAny:
										CodeCatalystAction<string, string, any, any>
									>;
							  }
							| { DependsOn: DependsOn[] }
						>,
						path: string[],
					) => {
						if ("DependsOn" in node && node.DependsOn !== undefined) {
							(node.DependsOn as unknown as string[]).forEach((id) => {
								if (!allids.includes(id)) {
									throw new VError(
										'Action dependency not found: "%s". Path: %s',
										id,
										[...path, "DependsOn", id].join("."),
									);
								}
							});
							return;
						}

						if (!node.Actions) {
							return;
						}

						Object.entries(node.Actions).forEach(([id, value]) => {
							checkMissing(value, [...path, "Actions", id]);
						});
					};

					Object.entries(acc).forEach(([id, value]) => {
						checkMissing(value, [id]);
					});
					return acc;
				},
				// biome-ignore lint/suspicious/noExplicitAny:
				{} as Record<string, CodeCatalystAction<string, string, any, any>>,
			),
		};

		const isSharedCompute =
			(
				this.compute as {
					SharedInstance?: string;
				}
			).SharedInstance === "TRUE";

		if (isSharedCompute) {
			let allDependsOn = Object.entries(workflow.Actions).map((action) => {
				let dependsOn = action[1].DependsOn || [];
				return [action[0], dependsOn] as [string, DependsOn[]];
			});

			let roots = allDependsOn.filter(([_, deps]) => deps.length === 0);

			if (roots.length !== 1) {
				throw new VError(
					{
						name: "INVALID_WORKFLOW",
						info: { workflow, roots },
					},
					`Shared compute workflows must have exactly one root action. ${JSON.stringify(
						roots,
					)} found`,
				);
			}
		}

		return workflow as CodeCatalystWorkflow<DependsOn, Inputs, Outputs>;
	}
}
