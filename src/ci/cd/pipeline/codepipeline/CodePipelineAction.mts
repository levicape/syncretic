import VError from "verror";
import type { Region } from "./CodePipelineDefinition.mjs";

export type CodePipelineActionType<
	Owner extends "AWS" | "ThirdParty" | "Custom",
	Category extends
		| "Source"
		| "Build"
		| "Deploy"
		| "Test"
		| "Invoke"
		| "Approval"
		| "Compute",
	Provider extends string,
	Version extends string,
	Configuration extends Record<
		string,
		string | string[] | undefined | Record<string, string>
	>,
	InputArtifacts extends { name: string }[] = { name: string }[],
	OutputArtifacts extends { name: string; files?: string[] }[] = {
		name: string;
	}[],
	OutputVariables extends string[] = string[],
> = {
	actionTypeId: {
		owner: Owner;
		category: Category;
		provider: Provider; // Builder validation: Minimum 1 character, Maximum 35 characters. Regex: ^[A-Za-z0-9_-]+$
		version: Version; // Builder validation: Minimum 1 character, Maximum 9 characters. Regex: ^[A-Za-z0-9_-]+$
	};
	configuration: Configuration; // Builder validation: Minimum 0 item, Maximum 200 items. Each item: Minimum 1 character, Maximum 1000 characters for value. Maximum 50 characters for key
	inputArtifacts: InputArtifacts;
	outputArtifacts: OutputArtifacts;
	outputVariables?: OutputVariables;
};

export type CodePipelineActionCategorySourceSpec =
	| CodePipelineActionType<
			"AWS",
			"Source",
			"S3",
			"1",
			{
				S3Bucket: string;
				S3ObjectKey: string;
				AllowOverrideForS3ObjectKey?: "true" | "false";
				PollForSourceChanges?: "true" | "false";
			},
			[] | never,
			[{ name: string }],
			["BucketName", "ETag", "ObjectKey", "VersionId"]
	  >
	| CodePipelineActionType<
			"AWS",
			"Source",
			"CodeStarSourceConnection",
			"1",
			{
				ConnectionArn: string;
				FullRepositoryId: string;
				BranchName: string;
				RepositoryName: string;
				CommitId: string;
			},
			[] | never,
			[{ name: string }],
			[
				"ConnectionArn",
				"FullRepositoryId",
				"BranchName",
				"RepositoryName",
				"CommitId",
			]
	  >
	| CodePipelineActionType<
			"AWS",
			"Source",
			"ECR",
			"1",
			{
				RepositoryName: string;
				ImageTag?: string; // Builder validation: Minimum 1 character, Maximum 300 characters. Default to latest.
			},
			[] | never,
			[{ name: string }],
			["RegistryId", "RepositoryName", "ImageDigest", "ImageURI", "ImageTag"]
	  >;

export type CodePipelineActionCategoryComputeSpec = CodePipelineActionType<
	"AWS",
	"Compute",
	"Commands",
	"1",
	{},
	{ name: string }[], // Builder validation: Minimum 1 item, Maximum 10 items
	[{ name: string; files: string[] }], // Builder validation: Minimum 0 item, Maximum 1 item
	string[]
>;

export type CodePipelineActionCategoryAnySpec = CodePipelineActionType<
	"AWS" | "ThirdParty" | "Custom",
	"Source" | "Build" | "Deploy" | "Test" | "Invoke" | "Approval" | "Compute",
	string,
	string,
	Record<string, string>,
	{ name: string }[],
	{ name: string; files?: string[] }[],
	string[]
>;

export type CodePipelineAction = {
	runOrder?: number; // Builder validation: Minimum 1, Maximum 999
	name: string; // Builder validation: Minimum 1 character, Maximum 100 characters. Regex: ^[A-Za-z0-9_-]+$
	namespace?: string;
	region?: Region; // Builder validation: Minimum 4 character, Maximum 30 characters
	roleArn?: string; // Builder validation: Minimum 20 character, Maximum 2048 characters. Regex: ^arn:aws:iam::[0-9]{12}:role/.*$
	timeoutInMinutes?: number; // Builder validation: Minimum 5, Maximum 480
	commands?: string[]; // Builder validation: Minimum 1 item, Maximum 50 items. Each item: Minimum 1 character, Maximum 1000 characters
} & (
	| CodePipelineActionCategorySourceSpec
	| CodePipelineActionCategoryComputeSpec
);

export class CodePipelineActionBuilder {
	private actionTypeId:
		| CodePipelineActionCategoryComputeSpec["actionTypeId"]
		| CodePipelineActionCategorySourceSpec["actionTypeId"]
		| CodePipelineActionCategoryAnySpec["actionTypeId"];
	private name: string;
	private configuration: Record<string, string> = {};
	private outputArtifacts: { name: string; files?: string[] }[] = [];
	private inputArtifacts: { name: string }[] = [];
	private outputVariables: string[] = [];
	private runOrder?: number;
	private namespace?: string;
	private commands: string[] = [];
	private region?: Region;
	private timeoutInMinutes?: number;
	private roleArn?: string;

	setActionTypeId(
		actionTypeId: CodePipelineActionCategoryAnySpec["actionTypeId"],
	): this {
		this.actionTypeId = actionTypeId;
		return this;
	}

	getActionTypeId(): CodePipelineActionCategoryAnySpec["actionTypeId"] {
		return this.actionTypeId;
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	getName(): string {
		return this.name;
	}

	setConfiguration(configuration: Record<string, string>): this {
		this.configuration = configuration;
		return this;
	}

	getConfiguration(): Record<string, string> | undefined {
		return this.configuration;
	}

	addOutputArtifact({ name, files }: { name: string; files?: string[] }): this {
		this.outputArtifacts.push({ name, files });
		return this;
	}

	setOutputArtifacts(
		outputArtifacts: { name: string; files?: string[] }[],
	): this {
		this.outputArtifacts = outputArtifacts;
		return this;
	}

	addInputArtifact(name: string): this {
		this.inputArtifacts.push({ name });
		return this;
	}

	setInputArtifacts(inputArtifacts: { name: string }[]): this {
		this.inputArtifacts = inputArtifacts;
		return this;
	}

	setRunOrder(runOrder: number): this {
		this.runOrder = runOrder;
		return this;
	}

	setNamespace(namespace: string): this {
		this.namespace = namespace;
		return this;
	}

	addCommand(command: string): this {
		this.commands.push(command);
		return this;
	}

	setCommands(commands: string[]): this {
		this.commands = commands;
		return this;
	}

	setRegion(region: Region): this {
		this.region = region;
		return this;
	}

	setTimeoutInMinutes(timeoutInMinutes: number): this {
		this.timeoutInMinutes = timeoutInMinutes;
		return this;
	}

	setRoleArn(roleArn: string): this {
		this.roleArn = roleArn;
		return this;
	}

	setOutputVariables(outputVariables: string[]): this {
		this.outputVariables = outputVariables;
		return this;
	}

	build(): CodePipelineAction {
		if (!this.actionTypeId) {
			throw new VError("Action Type ID is required");
		}

		if (!this.name) {
			throw new VError("Name is required");
		}

		if (this.commands.length !== 0) {
			if (this.commands.length < 1 || this.commands.length > 10) {
				throw new VError("Commands must be between 1 and 10");
			}

			if (this.actionTypeId.category !== "Compute") {
				throw new VError("Commands can only be used with Compute actions");
			}
		} else {
			if (this.actionTypeId.category === "Compute") {
				throw new VError("Commands are required for Compute actions");
			}
		}

		if (this.runOrder && (this.runOrder < 1 || this.runOrder > 999)) {
			throw new VError("Run Order must be between 1 and 999");
		}

		if (
			this.timeoutInMinutes &&
			(this.timeoutInMinutes < 5 || this.timeoutInMinutes > 480)
		) {
			throw new VError("Timeout in minutes must be between 5 and 480");
		}

		if (this.region && (this.region.length < 4 || this.region.length > 30)) {
			throw new VError("Region must be between 4 and 30 characters");
		}

		if (
			this.roleArn &&
			(this.roleArn.length < 20 || this.roleArn.length > 2048)
		) {
			throw new VError("Role ARN must be between 20 and 2048 characters");
		}

		const commands =
			this.commands.length !== 0
				? {
						commands: this.commands,
					}
				: {};

		const inputArtifacts =
			this.inputArtifacts.length !== 0
				? {
						inputArtifacts: this.inputArtifacts as unknown as [],
					}
				: {};

		const outputArtifacts =
			this.outputArtifacts.length !== 0
				? {
						outputArtifacts: this
							.outputArtifacts as unknown as CodePipelineAction["outputArtifacts"],
					}
				: {};

		const outputVariables =
			this.outputVariables.length !== 0
				? {
						outputVariables: this.outputVariables as unknown as [
							"RegistryId",
							"RepositoryName",
							"ImageDigest",
							"ImageURI",
							"ImageTag",
						],
					}
				: {};

		const configuration =
			Object.keys(this.configuration).length !== 0
				? {
						configuration: this.configuration,
					}
				: {};

		const timeoutInMinutes = this.timeoutInMinutes
			? {
					timeoutInMinutes: this.timeoutInMinutes,
				}
			: {};

		const region = this.region
			? {
					region: this.region,
				}
			: {};

		const roleArn = this.roleArn
			? {
					roleArn: this.roleArn,
				}
			: {};

		const runOrder = this.runOrder ? { runOrder: this.runOrder } : {};

		const namespace = this.namespace ? { namespace: this.namespace } : {};

		return {
			...runOrder,
			name: this.name,
			...namespace,
			...region,
			...roleArn,
			actionTypeId: this.actionTypeId,
			...configuration,
			...timeoutInMinutes,
			...inputArtifacts,
			...outputArtifacts,
			...outputVariables,
			...commands,
		} as unknown as CodePipelineAction;
	}
}

export class CodePipelineParallelActionBuilder {
	private actions: CodePipelineActionBuilder[] = [];

	addAction(action: CodePipelineActionBuilder): this {
		this.actions.push(action);
		return this;
	}

	setActions(actions: CodePipelineActionBuilder[]): this {
		this.actions = actions;
		return this;
	}

	build(): CodePipelineAction[] {
		return this.actions.map((action) => action.build());
	}
}
