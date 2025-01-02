import VError from "verror";
import type { Region } from "./CodePipelineDefinition.mjs";

export type CodePipelineRule = {
	name: string;
	ruleTypeId: {
		category: "Rule";
		provider: string; // Builder validation: Minimum 1 character, Maximum 35 characters. Regex: ^[A-Za-z0-9_-]+$
		owner?: "AWS";
		version?: string; // Builder validation: Minimum 1 character, Maximum 9 characters. Regex: ^[A-Za-z0-9_-]+$
	};
	commands?: string[]; // Builder validation: Minimum 1 item, Maximum 50 items. Each item: Minimum 1 character, Maximum 1000 characters
	configuration?: Record<string, string>; // Builder validation: Minimum 0 item, Maximum 200 items. Each item: Minimum 1 character, Maximum 1000 characters for value. Maximum 50 characters for key
	inputArtifacts?: {
		name: string; // Builder validation: Minimum 1 character, Maximum 100 characters. Regex: ^[A-Za-z0-9_-]+$
	}[];
	region?: Region; // Builder validation: Minimum 4 character, Maximum 30 characters
	timeoutInMinutes?: number; // Builder validation: Minimum 5, Maximum 86400.
	roleArn?: string;
};

export class CodePipelineRuleBuilder {
	private name: string;
	private ruleTypeId: {
		category: "Rule";
		provider: string;
		owner?: "AWS";
		version?: string;
	};
	private commands?: string[];
	private configuration?: Record<string, string>;
	private inputArtifacts?: { name: string }[];
	private region?: Region;
	private timeoutInMinutes?: number;
	private roleArn?: string;

	constructor(name: string) {
		this.name = name;
		this.ruleTypeId = {
			category: "Rule",
			provider: "",
		};
	}

	setCommands(commands: string[]): this {
		this.commands = commands;
		return this;
	}

	setConfiguration(configuration: Record<string, string>): this {
		this.configuration = configuration;
		return this;
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	setInputArtifacts(inputArtifacts: { name: string }[]): this {
		this.inputArtifacts = inputArtifacts;
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

	setRuleTypeId({
		category,
		owner,
		provider,
		version,
	}: {
		category: "Rule";
		owner: "AWS";
		provider: string;
		version: string;
	}): this {
		this.ruleTypeId = {
			category,
			owner,
			provider,
			version,
		};
		return this;
	}

	build(): CodePipelineRule {
		if (!this.name) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_NAME",
					info: {
						name: this.name,
					},
				},
				"Rule name must be provided",
			);
		}

		if (!this.ruleTypeId.provider) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_PROVIDER",
					info: {
						provider: this.ruleTypeId.provider,
					},
				},
				"Rule provider must be provided",
			);
		}

		if (this.commands && this.commands.length > 50) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_COMMANDS",
					info: {
						commands: this.commands,
					},
				},
				"Maximum of 50 commands allowed",
			);
		}

		if (this.configuration && Object.keys(this.configuration).length > 200) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_CONFIGURATION",
					info: {
						configuration: this.configuration,
					},
				},
				"Maximum of 200 configuration items allowed",
			);
		}

		if (this.inputArtifacts && this.inputArtifacts.length > 50) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_INPUT_ARTIFACTS",
					info: {
						inputArtifacts: this.inputArtifacts,
					},
				},
				"Maximum of 50 input artifacts allowed",
			);
		}

		if (this.region && (this.region.length < 4 || this.region.length > 30)) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_REGION",
					info: {
						region: this.region,
					},
				},
				"Region must be between 4 and 30 characters",
			);
		}

		if (
			this.timeoutInMinutes &&
			(this.timeoutInMinutes < 5 || this.timeoutInMinutes > 86400)
		) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_TIMEOUT",
					info: {
						timeoutInMinutes: this.timeoutInMinutes,
					},
				},
				"Timeout must be between 5 and 86400 minutes",
			);
		}

		if (this.roleArn && this.roleArn.length > 1000) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_RULE_ROLE_ARN",
					info: {
						roleArn: this.roleArn,
					},
				},
				"Role ARN must be less than 1000 characters",
			);
		}

		return {
			name: this.name,
			ruleTypeId: this.ruleTypeId,
			commands: this.commands,
			configuration: this.configuration,
			inputArtifacts: this.inputArtifacts,
			region: this.region,
			timeoutInMinutes: this.timeoutInMinutes,
			roleArn: this.roleArn,
		};
	}
}
