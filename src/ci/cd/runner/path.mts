import { spawnSync } from "node:child_process";
import { constants as fs, accessSync, existsSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { isWindows } from "../../machine/context/System.mjs";
import { getRunnerOptions } from "./RunnerOptions.mjs";

class PError extends Error {
	constructor(
		public message: string,
		public cause?: unknown,
	) {
		super(message);
	}
}

let __execPath: string | undefined;
export function getExecPath(nodeExe: string) {
	if (__execPath) {
		return __execPath;
	}

	const {
		timeouts: { spawnTimeout },
	} = getRunnerOptions();

	let execPath: string | undefined;
	let error: unknown;
	try {
		const { error, stdout } = spawnSync(
			nodeExe,
			["--print", "process.argv[0]"],
			{
				encoding: "utf-8",
				timeout: spawnTimeout,
				env: {
					// @ts-ignore
					PATH: process.env.PATH,
					NODE_DEBUG_QUIET_LOGS: "1",
				},
			},
		);
		if (error) {
			throw error;
		}
		execPath = stdout.trim();
	} catch (cause) {
		error = cause;
	}

	if (execPath) {
		if (isExecutable(execPath)) {
			__execPath = execPath;
			return execPath;
		}
		error = new Error(`File is not an executable: ${execPath}`);
	}

	throw new PError(`Could not find executable: ${nodeExe}`, { cause: error });
}

export function addPath(...paths: string[]): string {
	if (isWindows) {
		return paths.join(";");
	}
	return paths.join(":");
}

export function isExecutable(execPath: string): boolean {
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

export function isHidden(path: string) {
	return (
		/node_modules|node.js/.test(dirname(path)) || /^\./.test(basename(path))
	);
}
