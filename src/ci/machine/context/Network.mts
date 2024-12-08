import { hostname } from "node:os";
import { executeSync } from "../Execute.mjs";
import { isBuildkite } from "../executor/Buildkite.mjs";
import { isGithubAction } from "../executor/GithubActions.mjs";
import { getEnv } from "./Environment.mjs";

export function getPublicIp(): string | undefined {
	for (const url of ["https://checkip.amazonaws.com", "https://ipinfo.io/ip"]) {
		const { error, stdout } = executeSync(["curl", url]);
		if (!error) {
			return stdout.trim();
		}
	}

	return;
}

export function getHostname(): string {
	if (isBuildkite) {
		const agent = getEnv("BUILDKITE_AGENT_NAME", false);
		if (agent) {
			return agent;
		}
	}

	if (isGithubAction) {
		const runner = getEnv("RUNNER_NAME", false);
		if (runner) {
			return runner;
		}
	}

	return hostname();
}
