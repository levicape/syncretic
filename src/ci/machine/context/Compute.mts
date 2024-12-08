import { userInfo } from "node:os";
import { isBuildkite } from "../executor/Buildkite.mjs";
import { isGithubAction } from "../executor/GithubActions.mjs";
import { getEnv } from "./Environment.mjs";

export const isCI =
	getEnv("CI", false) === "true" || isBuildkite || isGithubAction;

export function getUsername() {
	const { username } = userInfo();
	return username;
}
