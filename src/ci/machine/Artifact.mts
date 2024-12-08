import { relative } from "node:path";
import { executeSafe } from "./Execute.mjs";
import { isBuildkite } from "./executor/Buildkite.mjs";

export async function uploadArtifact(filename: string, cwd?: string) {
	if (isBuildkite) {
		const relativePath = relative(cwd ?? process.cwd(), filename);
		await executeSafe(["buildkite-agent", "artifact", "upload", relativePath], {
			cwd,
			stdio: "inherit",
		});
	}
}
