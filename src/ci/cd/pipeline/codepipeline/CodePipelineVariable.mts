import VError from "verror";

export type CodePipelineVariable = {
	name: string; // Builder Validation: Minimum 1 character, Maximum 100 characters. Regex: ^[A-Za-z0-9_-]+$
	defaultValue?: string; // Builder Validation: Minimum 1 character, Maximum 1000 characters
	description?: string; // Builder Validation: Minimum 1 character, Maximum 1000 characters
};

export const CodePipelineVariableNameRegex = /^[A-Za-z0-9_-]+$/;

export class CodePipelineVariableBuilder {
	private name: string;
	private defaultValue?: string;
	private description?: string;

	constructor(name: string) {
		this.name = name;
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	setDefaultValue(defaultValue: string): this {
		this.defaultValue = defaultValue;
		return this;
	}

	setDescription(description: string): this {
		this.description = description;
		return this;
	}

	build(): CodePipelineVariable {
		if (!CodePipelineVariableNameRegex.test(this.name)) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_VARIABLE_NAME",
					info: {
						name: this.name,
					},
				},
				`Variable names must match /[A-Za-z0-9_-]+/ but got ${this.name}`,
			);
		}

		if (this.name.length < 1 || this.name.length > 100) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_VARIABLE_NAME",
					info: {
						name: this.name,
					},
				},
				`Variable name must be between 1 and 100 characters but got ${this.name.length}`,
			);
		}

		if (this.defaultValue && this.defaultValue.length > 1000) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_VARIABLE_DEFAULT_VALUE",
					info: {
						defaultValue: this.defaultValue,
					},
				},
				`Variable default value must be less than 1000 characters but got ${this.defaultValue.length}`,
			);
		}

		if (this.description && this.description.length > 1000) {
			throw new VError(
				{
					name: "INVALID_CODEPIPELINE_VARIABLE_DESCRIPTION",
					info: {
						description: this.description,
					},
				},
				`Variable description must be less than 1000 characters but got ${this.description.length}`,
			);
		}

		return {
			name: this.name,
			description: this.description,
			defaultValue: this.defaultValue,
		};
	}
}
