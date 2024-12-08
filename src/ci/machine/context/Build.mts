import {
	getBuildkiteArtifacts,
	getBuildkiteBuildNumber,
	isBuildkite,
} from "../executor/Buildkite.mjs";
import { isGithubAction } from "../executor/GithubActions.mjs";
import { getEnv } from "./Environment.mjs";

export function getBuildId(): string | undefined {
	if (isBuildkite) {
		return getEnv("BUILDKITE_BUILD_ID");
	}

	if (isGithubAction) {
		return getEnv("GITHUB_RUN_ID");
	}

	return;
}

export function getBuildNumber(): number | undefined {
	if (isBuildkite) {
		return Number.parseInt(getEnv("BUILDKITE_BUILD_NUMBER") ?? "");
	}

	if (isGithubAction) {
		return Number.parseInt(getEnv("GITHUB_RUN_ID") || "");
	}

	return;
}

export function getBuildUrl(): URL | undefined {
	if (isBuildkite) {
		const buildUrl = getEnv("BUILDKITE_BUILD_URL");
		const jobId = getEnv("BUILDKITE_JOB_ID");
		return new URL(`#${jobId}`, buildUrl);
	}

	if (isGithubAction) {
		const baseUrl = getEnv("GITHUB_SERVER_URL", false) || "https://github.com";
		const repository = getEnv("GITHUB_REPOSITORY");
		const runId = getEnv("GITHUB_RUN_ID");
		return new URL(`${repository}/actions/runs/${runId}`, baseUrl);
	}

	return;
}

export function getBuildLabel(): string | undefined {
	if (isBuildkite) {
		const label =
			getEnv("BUILDKITE_LABEL", false) ||
			getEnv("BUILDKITE_GROUP_LABEL", false);
		if (label) {
			return label;
		}
	}

	if (isGithubAction) {
		const label = getEnv("GITHUB_WORKFLOW", false);
		if (label) {
			return label;
		}
	}

	return;
}

export async function getBuildArtifacts() {
	const buildId = await getBuildkiteBuildNumber();
	if (buildId) {
		return getBuildkiteArtifacts(buildId.toString());
	}

	return [];
}
