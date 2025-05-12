import packageJson from "../package.json" with { type: "json" };

const { version } = packageJson;
const [major, minor] = version.split(".");
const ref = `v${major}.${minor}`;

const directoryName = "templates";
export const CreateFourtwoConfig = {
	directory: directoryName,
	ref,
} as const;
