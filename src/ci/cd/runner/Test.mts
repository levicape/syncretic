import { constants as fs, accessSync, existsSync, statSync } from "node:fs";
import { basename, dirname, sep } from "node:path";
import { getEnv } from "../../machine/context/Environment.mjs";
import { isBuildkite } from "../../machine/executor/Buildkite.mjs";
import { isGithubAction } from "../../machine/executor/GithubActions.mjs";
import { getRunnerOptions } from "./RunnerOptions.mjs";

export interface VendorTest {
	cwd: string;
	packageManager: string;
	testRunner: string;
	testPaths: string[];
}

export interface TestEntry {
	url?: string;
	file?: string;
	test?: string;
	status?: string;
	error?: TestError | string;
	duration?: number;
}

export interface TestError {
	url: string;
	file: string;
	line: number;
	col: number;
	name: string;
	stack: string;
}

export interface TestResult {
	testPath: string;
	ok?: boolean;
	status?: string;
	error?: string;
	errors?: Array<TestError | string | undefined>;
	test?: string;
	tests?: TestEntry[];
	stdout: string;
	stdoutPreview: string;
	executions?: TestResult[];
	url?: string;
	file?: string;
	duration?: number;
}

interface String {
	replaceAll(input: string, output: string): string;
}

export class Test {
	static getTestTimeout(testPath: string) {
		const {
			timeouts: { testTimeout, integrationTimeout },
		} = getRunnerOptions();
		if (/integration|3rd_party|docker/i.test(testPath)) {
			return integrationTimeout;
		}
		return testTimeout;
	}

	static isJavaScript(path: string): boolean {
		return /\.(c|m)?(j|t)sx?$/.test(basename(path));
	}

	static isJavaScriptTest(path: string): boolean {
		return Test.isJavaScript(path) && /\.test|spec\./.test(basename(path));
	}

	static isTest(path: string & String): boolean {
		if (
			path.replaceAll(sep, "/").includes("/test-cluster-") &&
			path.endsWith(".js")
		)
			return true;
		if (
			path.replaceAll(sep, "/").startsWith("js/node/cluster/test-") &&
			path.endsWith(".ts")
		)
			return true;
		return Test.isTestStrict(path);
	}

	static isTestStrict(path: string) {
		return Test.isJavaScript(path) && /\.test|spec\./.test(basename(path));
	}

	static isHidden(path: string) {
		return (
			/node_modules|node.js/.test(dirname(path)) || /^\./.test(basename(path))
		);
	}

	static getBuildLabel() {
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
	static isExecutable(execPath: string) {
		if (!existsSync(execPath) || !statSync(execPath).isFile()) {
			return false;
		}
		try {
			accessSync(execPath, fs.X_OK);
		} catch {
			return false;
		}
		return true;
	}
}
