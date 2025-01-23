import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BuildkiteBuild } from "../../cd/pipeline/buildkite/BuildkitePipeline.mjs";
import { getRunnerOptions } from "../../cd/runner/RunnerOptions.mjs";
import { Spawn, type SpawnOptions } from "../../cd/runner/Spawn.mjs";
import { Test } from "../../cd/runner/Test.mjs";
import { getTestLabel } from "../../cd/runner/output.mjs";
import { getExecPath } from "../../cd/runner/path.mjs";
import { getCommit, getRepository } from "../code/Git.mjs";
import { getBuildUrl } from "../context/Build.mjs";
import { getEnv } from "../context/Environment.mjs";
import { unzip } from "../context/Filesystem.mjs";
import { escapeCodeBlock } from "../context/Parsing.mjs";
import { curl, curlSafe } from "../context/Process.mjs";

export const isBuildkite = getEnv("BUILDKITE", false) === "true";

let __lastSuccessfulBuild: BuildkiteBuild | undefined;
export const getLastSuccessfulBuild: () => Promise<BuildkiteBuild | undefined> =
	async () => {
		if (__lastSuccessfulBuild === undefined) {
			__lastSuccessfulBuild = await (async () => {
				if (isBuildkite) {
					let depth = 0;
					let url = getBuildUrl();
					if (url) {
						url.hash = "";
					}

					while (url) {
						const { error, body } = await curl(`${url}.json`, { json: true });
						if (error) {
							return;
						}

						const {
							state,
							prev_branch_build: previousBuild,
							steps,
						} = body as {
							state: string;
							prev_branch_build: BuildkiteBuild | undefined;
							steps: Array<{ label: string; outcome: string }>;
						};

						if (depth++) {
							if (
								state === "failed" ||
								state === "passed" ||
								state === "canceled"
							) {
								const buildSteps = steps.filter(({ label }) =>
									label.endsWith("build-node"),
								);
								if (buildSteps.length) {
									if (buildSteps.every(({ outcome }) => outcome === "passed")) {
										return body as BuildkiteBuild;
									}
									return;
								}
							}
						}

						if (!previousBuild) {
							return;
						}

						url = new URL(previousBuild.url ?? "", url);
					}
				}
				return;
			})();
		}
		return __lastSuccessfulBuild;
	};

export const getExecPathFromBuildKite = async (
	target: string,
): Promise<string> => {
	if (existsSync(target) || target.includes("/")) {
		return getExecPath(target);
	}
	const {
		cwd,
		timeouts: { spawnTimeout },
	} = getRunnerOptions();

	const releasePath = join(cwd, "release");
	mkdirSync(releasePath, { recursive: true });

	const args = ["artifact", "download", "**", releasePath, "--step", target];
	const buildId = process.env.BUILDKITE_ARTIFACT_BUILD_ID;
	if (buildId) {
		args.push("--build", buildId);
	}

	await Spawn.spawnSafe({
		command: "buildkite-agent",
		args,
	} as unknown as SpawnOptions);

	let zipPath: string | undefined;
	for (const entry of readdirSync(releasePath, {
		recursive: true,
		encoding: "utf-8",
	})) {
		if (/^node.*\.zip$/i.test(entry) && !entry.includes("-profile.zip")) {
			zipPath = join(releasePath, entry);
			break;
		}
	}

	if (!zipPath) {
		throw new Error(
			`Could not find ${target}.zip from Buildkite: ${releasePath}`,
		);
	}

	await unzip(zipPath, releasePath);

	for (const entry of readdirSync(releasePath, {
		recursive: true,
		encoding: "utf-8",
	})) {
		const execPath = join(releasePath, entry);
		if (/node(?:\.exe)?$/i.test(entry) && Test.isExecutable(execPath)) {
			return execPath;
		}
	}

	throw new Error(`Could not find executable from BuildKite: ${releasePath}`);
};

/**
 * @param {string} glob
 */
export function uploadArtifactsToBuildKite(glob: string) {
	const {
		cwd,
		timeouts: { spawnTimeout },
	} = getRunnerOptions();

	spawn("buildkite-agent", ["artifact", "upload", glob], {
		stdio: ["ignore", "ignore", "ignore"],
		timeout: spawnTimeout,
		cwd,
	});
}

/**
 * @param {string} [glob]
 * @param {string} [step]
 */
export function listArtifactsFromBuildKite(glob: string, step: string) {
	const {
		cwd,
		timeouts: { spawnTimeout },
	} = getRunnerOptions();

	const args = [
		"artifact",
		"search",
		"--no-color",
		"--allow-empty-results",
		"--include-retried-jobs",
		"--format",
		"%p\n",
		glob || "*",
	];
	if (step) {
		args.push("--step", step);
	}
	const { error, status, signal, stdout, stderr } = spawnSync(
		"buildkite-agent",
		args,
		{
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf-8",
			timeout: spawnTimeout,
			cwd,
		},
	);
	if (status === 0) {
		return stdout?.split("\n").map((line) => line.trim()) || [];
	}
	const cause = error ?? signal ?? `code ${status}`;
	console.warn("Failed to list artifacts from BuildKite:", cause, stderr);
	return [];
}

interface BuildkiteAnnotation {
	label: string;
	content: string;
	style?: "error" | "warning" | "info";
	priority?: number;
	attempt?: number;
}

export function reportAnnotationToBuildKite({
	label,
	content,
	style = "error",
	priority = 3,
	attempt = 0,
}: BuildkiteAnnotation) {
	const {
		cwd,
		timeouts: { spawnTimeout },
	} = getRunnerOptions();
	const { error, status, signal, stderr } = spawnSync(
		"buildkite-agent",
		[
			"annotate",
			"--append",
			"--style",
			`${style}`,
			"--context",
			`${label}`,
			"--priority",
			`${priority}`,
		],
		{
			input: content,
			stdio: ["pipe", "ignore", "pipe"],
			encoding: "utf-8",
			timeout: spawnTimeout,
			cwd,
		},
	);
	if (status === 0) {
		return;
	}
	if (attempt > 0) {
		const cause = error ?? signal ?? `code ${status}`;
		throw cause;
	}
	const buildLabel = getTestLabel();
	const buildUrl = getBuildUrl();
	const platform = buildUrl
		? `<a href="${buildUrl}">${buildLabel}</a>`
		: buildLabel;
	let errorMessage = `<details><summary><a><code>${label}</code></a> - annotation error on ${platform}</summary>`;
	if (stderr) {
		errorMessage += `\n\n\`\`\`terminal\n${escapeCodeBlock(stderr)}\n\`\`\`\n\n</details>\n\n`;
	}
	reportAnnotationToBuildKite({
		label: `${label}-error`,
		content: errorMessage,
		attempt: attempt + 1,
	});
}

export async function getBuildkiteBuildNumber(): Promise<number | undefined> {
	if (isBuildkite) {
		const number = Number.parseInt(
			getEnv("BUILDKITE_BUILD_NUMBER", false) ?? "",
		);
		if (!Number.isNaN(number)) {
			return number;
		}
	}

	const repository = getRepository();
	const commit = getCommit();
	if (!repository || !commit) {
		return;
	}

	const { status, error, body } = await curl(
		`https://api.github.com/repos/${repository}/commits/${commit}/statuses`,
		{
			json: true,
		},
	);
	if (status === 404) {
		return;
	}
	if (error) {
		throw error;
	}

	for (const { target_url: url } of body as Array<{ target_url: string }>) {
		const { hostname, pathname } = new URL(url);
		if (hostname === "buildkite.com") {
			const buildId = Number.parseInt((pathname ?? "").split("/").pop() ?? "");
			if (!Number.isNaN(buildId)) {
				return buildId;
			}
		}
	}
	return;
}
export type BuildkiteBuildArtifact = {
	job: string;
	filename: string;
	url: string;
};
export async function getBuildkiteArtifacts(
	buildId: string,
): Promise<BuildkiteBuildArtifact[]> {
	const orgId = getEnv("BUILDKITE_ORGANIZATION_SLUG", false) || "node";
	const pipelineId = getEnv("BUILDKITE_PIPELINE_SLUG", false) || "node";
	const { jobs } = (await curlSafe(
		`https://buildkite.com/${orgId}/${pipelineId}/builds/${buildId}.json`,
		{
			json: true,
		},
	)) as { jobs: Array<{ id: string; step_key: string }> };

	const artifacts = await Promise.all(
		jobs.map(async ({ id: jobId, step_key: jobKey }) => {
			const artifacts = (await curlSafe(
				`https://buildkite.com/organizations/${orgId}/pipelines/${pipelineId}/builds/${buildId}/jobs/${jobId}/artifacts`,
				{ json: true },
			)) as Array<{ path: string; url: string }>;

			return artifacts.map(({ path, url }) => {
				return {
					job: jobKey,
					filename: path,
					url: new URL(url, "https://buildkite.com/").toString(),
				};
			});
		}),
	);

	return artifacts.flat();
}

export function getCachePath(branch?: string): string {
	const buildPath: string | undefined = process.env.BUILDKITE_BUILD_PATH;
	const repository: string | undefined = process.env.BUILDKITE_REPO;
	const fork: string | undefined = process.env.BUILDKITE_PULL_REQUEST_REPO;
	const repositoryKey: string =
		(fork || repository)?.replace(/[^a-z0-9]/gi, "-") ?? "";
	const branchName: string =
		(branch || process.env.BUILDKITE_BRANCH)?.replace(/[^a-z0-9]/gi, "-") ?? "";
	const branchKey: string = branchName.startsWith("gh-readonly-queue-")
		? branchName.slice(18, branchName.indexOf("-pr-"))
		: branchName;
	const stepKey: string | undefined = process.env.BUILDKITE_STEP_KEY?.replace(
		/[^a-z0-9]/gi,
		"-",
	);
	return resolve(
		buildPath ?? "",
		"..",
		"cache",
		repositoryKey,
		branchKey,
		stepKey ?? "",
	);
}
