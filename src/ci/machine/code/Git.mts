import { spawnSync as nodeSpawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { executeSync } from "../Execute.mjs";
import { getEnv } from "../context/Environment.mjs";
import { readFile } from "../context/Filesystem.mjs";
import { curl } from "../context/Process.mjs";
import { isBuildkite } from "../executor/Buildkite.mjs";
import { getGithubApiUrl, isGithubAction } from "../executor/GithubActions.mjs";

let __branch: string | undefined;
export const getBranch = (cwd?: string) => {
	if (__branch === undefined) {
		__branch = (() => {
			if (!cwd) {
				if (isBuildkite) {
					const branch = getEnv("BUILDKITE_BRANCH", false);
					if (branch) {
						return branch;
					}
				}

				if (isGithubAction) {
					const ref = getEnv("GITHUB_REF_NAME", false);
					if (ref) {
						return ref;
					}
				}
			}

			const { error, stdout } = executeSync(
				["git", "rev-parse", "--abbrev-ref", "HEAD"],
				{ cwd },
			);
			if (!error) {
				return stdout.trim();
			}

			return;
		})();
	}
	return __branch;
};

let __commit: string | undefined;
export const getCommit = (cwd?: string) => {
	if (__commit === undefined) {
		__commit = (() => {
			if (!cwd) {
				if (isBuildkite) {
					const commit = getEnv("BUILDKITE_COMMIT", false);
					if (commit) {
						return commit;
					}
				}

				if (isGithubAction) {
					const commit = getEnv("GITHUB_SHA", false);
					if (commit) {
						return commit;
					}
				}
			}

			const { error, stdout } = executeSync(["git", "rev-parse", "HEAD"], {
				cwd,
			});
			if (!error) {
				return stdout.trim();
			}

			return;
		})();
	}
	return __commit;
};

let __commitMessage: string | undefined;
export const getCommitMessage = (cwd?: string) => {
	if (__commitMessage === undefined) {
		__commitMessage = (() => {
			if (!cwd) {
				if (isBuildkite) {
					const message = getEnv("BUILDKITE_MESSAGE", false);
					if (message) {
						return message;
					}
				}
			}

			const { error, stdout } = executeSync(
				["git", "log", "-1", "--pretty=%B"],
				{
					cwd,
				},
			);
			if (!error) {
				return stdout.trim();
			}

			return;
		})();
	}
	return __commitMessage;
};

let __mainBranch: string | undefined;
export const getMainBranch = (cwd?: string) => {
	if (__mainBranch === undefined) {
		__mainBranch = (() => {
			if (!cwd) {
				if (isBuildkite) {
					const branch = getEnv("BUILDKITE_PIPELINE_DEFAULT_BRANCH", false);
					if (branch) {
						return branch;
					}
				}

				if (isGithubAction) {
					const headRef = getEnv("GITHUB_HEAD_REF", false);
					if (headRef) {
						return headRef;
					}
				}
			}

			const { error, stdout } = executeSync(
				["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
				{ cwd },
			);
			if (!error) {
				return stdout.trim().replace("refs/remotes/origin/", "");
			}

			return;
		})();
	}
	return __mainBranch;
};

let __isPullRequest: boolean | undefined;
export const isPullRequest = () => {
	if (__isPullRequest === undefined) {
		__isPullRequest = (() => {
			if (isBuildkite) {
				return !!getEnv("BUILDKITE_PULL_REQUEST", false);
			}

			if (isGithubAction) {
				const pullRequest =
					getEnv("GITHUB_EVENT_NAME", false) === "pull_request";
				if (pullRequest && getEnv("GITHUB_HEAD_REF", false)) {
					return true;
				}
			}

			return;
		})();
	}
	return __isPullRequest;
};

let __targetBranch: string | undefined;
export const getTargetBranch = () => {
	if (__targetBranch === undefined) {
		__targetBranch = (() => {
			if (isPullRequest()) {
				if (isBuildkite) {
					return getEnv("BUILDKITE_PULL_REQUEST_BASE_BRANCH", false);
				}

				if (isGithubAction) {
					return getEnv("GITHUB_BASE_REF", false);
				}
			}

			return;
		})();
	}
	return __targetBranch;
};

let __isMainBranch: boolean | undefined;
export const isMainBranch = (cwd?: string) => {
	if (__isMainBranch === undefined) {
		__isMainBranch = !isFork(cwd) && getBranch(cwd) === getMainBranch(cwd);
	}
	return __isMainBranch;
};

let __isFork: boolean | undefined;
export const isFork = (cwd?: string) => {
	if (__isFork === undefined) {
		__isFork = (() => {
			if (isBuildkite) {
				const repository = getEnv("BUILDKITE_PULL_REQUEST_REPO", false);
				return !!repository && repository !== getEnv("BUILDKITE_REPO", false);
			}

			if (isGithubAction) {
				const eventPath = getEnv("GITHUB_EVENT_PATH", false);
				if (eventPath && existsSync(eventPath)) {
					const event = JSON.parse(readFile(eventPath, { cache: true }));
					const pullRequest = event.pull_request;
					if (pullRequest) {
						return !!pullRequest.head.repo.fork;
					}
				}
			}

			return false;
		})();
	}
	return __isFork;
};

let __isMergeQueue: boolean | undefined;
export const isMergeQueue = (cwd?: string) => {
	if (__isMergeQueue === undefined) {
		__isMergeQueue = (() => {
			return /^gh-readonly-queue/.test(getBranch(cwd) ?? "");
		})();
	}
	return __isMergeQueue;
};

let __revision: string | undefined;
export function getRevision({
	execPath,
	spawnTimeout,
}: { execPath: string; spawnTimeout: number }) {
	if (__revision === undefined) {
		__revision = (() => {
			try {
				const { error, stdout } = nodeSpawnSync(execPath, ["--revision"], {
					encoding: "utf-8",
					timeout: spawnTimeout,
					env: {
						PATH: process.env.PATH,
					},
				});
				if (error) {
					throw error;
				}
				return stdout.trim();
			} catch (error) {
				console.warn(error);
				return "<unknown>";
			}
		})();
	}

	return __revision;
}

let __repository: string | undefined;
export const getRepository = (cwd?: string) => {
	if (__repository === undefined) {
		__repository = (() => {
			if (!cwd) {
				if (isGithubAction) {
					const repository = getEnv("GITHUB_REPOSITORY", false);
					if (repository) {
						return repository;
					}
				}
			}

			const url = getRepositoryUrl(cwd);
			if (url) {
				const { hostname, pathname } = new URL(url);
				if (hostname === "github.com") {
					return pathname.slice(1);
				}
			}

			return;
		})();
	}

	return __repository;
};

let __pullRequest: number | undefined;
export const getPullRequest = () => {
	if (__pullRequest === undefined) {
		__pullRequest = (() => {
			if (isBuildkite) {
				const pullRequest = getEnv("BUILDKITE_PULL_REQUEST", false);
				if (pullRequest) {
					return Number.parseInt(pullRequest);
				}
			}

			if (isGithubAction) {
				const eventPath = getEnv("GITHUB_EVENT_PATH", false);
				if (eventPath && existsSync(eventPath)) {
					const event = JSON.parse(readFile(eventPath, { cache: true }));
					return event?.pull_request?.number;
				}
			}

			return;
		})();
	}

	return __pullRequest;
};

let __canaryRevision: number | undefined;
export const getCanaryRevision: () => Promise<number> = async () => {
	if (__canaryRevision === undefined) {
		__canaryRevision = await (async () => {
			{
				const repository = getRepository() || "oven-sh/bun";
				const { error: releaseError, body: release } = await curl(
					new URL(`repos/${repository}/releases/latest`, getGithubApiUrl()),
					{ json: true },
				);
				if (releaseError) {
					return 1;
				}

				const commit = getCommit();
				const { tag_name: latest } = release as { tag_name: string };
				const { error: compareError, body: compare } = await curl(
					new URL(
						`repos/${repository}/compare/${latest}...${commit}`,
						getGithubApiUrl(),
					),
					{ json: true },
				);
				if (compareError) {
					return 1;
				}

				const { ahead_by: revision } = compare as { ahead_by: number };
				if (typeof revision === "number") {
					return revision;
				}

				return 1;
			}
		})();
	}
	return __canaryRevision;
};

export function parseGitUrl(url: string | URL): URL {
	const string = typeof url === "string" ? url : url.toString();

	const githubUrl = getEnv("GITHUB_SERVER_URL", false) || "https://github.com";
	if (/^git@github\.com:/.test(string)) {
		return new URL(string.slice(15).replace(/\.git$/, ""), githubUrl);
	}
	if (/^https:\/\/github\.com\//.test(string)) {
		return new URL(string.slice(19).replace(/\.git$/, ""), githubUrl);
	}

	throw new Error(`Unsupported git url: ${string}`);
}

export function getRepositoryUrl(cwd?: string): URL | undefined {
	if (!cwd) {
		if (isBuildkite) {
			const repository =
				getEnv("BUILDKITE_PULL_REQUEST_REPO", false) ||
				getEnv("BUILDKITE_REPO", false);
			if (repository) {
				return parseGitUrl(repository);
			}
		}

		if (isGithubAction) {
			const serverUrl =
				getEnv("GITHUB_SERVER_URL", false) || "https://github.com";
			const repository = getEnv("GITHUB_REPOSITORY", false);
			if (serverUrl && repository) {
				return parseGitUrl(new URL(repository, serverUrl));
			}
		}

		return;
	}

	const { error, stdout } = executeSync(
		["git", "remote", "get-url", "origin"],
		{
			cwd,
		},
	);
	if (!error) {
		return parseGitUrl(stdout.trim());
	}

	return;
}

export function getDefaultBranch() {
	return process.env.BUILDKITE_PIPELINE_DEFAULT_BRANCH || "main";
}
