import { join } from "node:path";
import { parseArgs } from "node:util";
import { getEnv } from "../../machine/context/Environment.mjs";

const spawnTimeout = 5_000;
const testTimeout = 2.2 * 60_000;
const integrationTimeout = 5 * 60_000;

export type RunnerOptions = {
	cwd: string;
	timeouts: {
		spawnTimeout: number;
		testTimeout: number;
		integrationTimeout: number;
	};
	testsPath: string;
	options: {
		"exec-path": string;
		step: string;
		bail: boolean;
		shard: string;
		"max-shards": string;
		include: string[];
		exclude: string[];
		smoke: string;
		vendor: string;
		"max-attempts": string;
		"max-retries": string;
	};
	filters: string[];
};

let cwd = "";
export const setRunnerCwd = (root: string) => {
	cwd = root;
};

let __options: RunnerOptions | undefined;
export const getRunnerOptions = (): RunnerOptions => {
	if (cwd === "") {
		throw new Error(
			"CWD must be initialized by the root script. Please use setRunnerCwd to set cwd",
		);
	}

	if (__options !== undefined) {
		return __options;
	}

	const testsPath = join(cwd, "test");

	const { values: options, positionals: filters } = parseArgs({
		allowPositionals: true,
		options: {
			"exec-path": {
				type: "string",
				default: "node",
			},
			step: {
				type: "string",
				default: undefined,
			},
			bail: {
				type: "boolean",
				default: false,
			},
			shard: {
				type: "string",
				default: getEnv("BUILDKITE_PARALLEL_JOB", false) || "0",
			},
			"max-shards": {
				type: "string",
				default: getEnv("BUILDKITE_PARALLEL_JOB_COUNT", false) || "1",
			},
			include: {
				type: "string",
				multiple: true,
				default: undefined,
			},
			exclude: {
				type: "string",
				multiple: true,
				default: undefined,
			},
			smoke: {
				type: "string",
				default: undefined,
			},
			vendor: {
				type: "string",
				default: undefined,
			},
			"max-attempts": {
				type: "string",
				default: "2",
			},
			"max-retries": {
				type: "string",
				default: "2",
			},
		},
	});

	__options = {
		cwd,
		testsPath,
		timeouts: {
			spawnTimeout: spawnTimeout,
			integrationTimeout: integrationTimeout,
			testTimeout: testTimeout,
		},
		options: options as RunnerOptions["options"],
		filters,
	};

	return __options;
};
