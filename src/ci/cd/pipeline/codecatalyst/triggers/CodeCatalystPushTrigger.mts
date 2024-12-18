export type CodeCatalystPushTriggerSpec = {
	Type: "PUSH";
	Branches: string[];
};

export const CodeCatalystTriggerPushGitopsMain = () => ({
	Type: "PUSH",
	Branches: ["main"],
});

export const CodeCatalystTriggerPushGitopsDevelop = () => ({
	Type: "PUSH",
	Branches: ["develop", "feature/*", "release/*", "hotfix/*"],
});
