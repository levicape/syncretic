import packageJson from "../package.json" with { type: "json" };

const { version } = packageJson;
const [major, minor] = version.split(".");
const ref = `v${major}.${minor}`;

const directoryName = "templates";
export const CreateSyncreticConfig = {
	directory: directoryName,
	ref,
} as const;
