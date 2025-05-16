export const CliTemplates = {
	devfile: {
		name: "Devfile",
	},
	["github-actions"]: {
		name: "Github Actions (Inline)",
	},
	["github-actions-cli"]: {
		name: "Github Actions (CLI)",
	},
} as const;

export const CliTemplateIds = Object.keys(CliTemplates) as Array<
	keyof typeof CliTemplates
>;

export type CliResource = keyof typeof CliTemplates;
