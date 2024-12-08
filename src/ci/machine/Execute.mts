import type { SpawnSyncReturns } from "node:child_process";
import {
	spawn as nodeSpawn,
	spawnSync as nodeSpawnSync,
} from "node:child_process";
import type { SpawnOptions, SpawnResult } from "../cd/runner/Spawn.mjs";
import { debugLog } from "../machine/Debug.mjs";
import { getWindowsExitReason } from "./context/Process.mjs";
import { isWindows } from "./context/System.mjs";

class PError extends Error {
	readonly cause?: Error | string;

	constructor(message: string, { cause }: { cause?: Error | string } = {}) {
		super(message);
		this.cause = cause;
	}
}

export async function executeSafe(
	command: string[],
	options?: SpawnOptions,
): Promise<SpawnResult> {
	const result = await execute(command, options);

	const { error } = result;
	if (error) {
		throw error;
	}

	return result;
}

export function executeSync(
	command: string[],
	options: SpawnOptions = {},
): SpawnResult {
	const [cmd, ...args] = parseCommand(command, options);
	const then = Date.now();
	debugLog("$", cmd, ...args);

	const spawnOptions = {
		cwd: options.cwd ?? process.cwd(),
		timeout: options.timeout ?? undefined,
		env: options.env ?? undefined,
		stdio: ["ignore", "pipe", "pipe"] as unknown as number[],
		...options,
	};

	let exitCode = 1 as number | string;
	let signalCode: string | undefined;
	let stdout = "";
	let stderr = "";
	let error: Error | string | undefined;

	let result: SpawnSyncReturns<Buffer> | { error: Error };
	try {
		result = nodeSpawnSync(cmd, args, spawnOptions);
	} catch (error) {
		result = { error: error as Error };
	}

	const {
		error: spawnError,
		status,
		signal,
		stdout: stdoutBuffer,
		stderr: stderrBuffer,
	} = result as SpawnSyncReturns<Buffer>;
	if (spawnError) {
		error = spawnError;
	} else {
		exitCode = status ?? 1;
		signalCode = signal || undefined;
		stdout = stdoutBuffer?.toString();
		stderr = stderrBuffer?.toString();
	}

	if (exitCode !== 0 && isWindows) {
		const exitReason = getWindowsExitReason(exitCode as number);
		if (exitReason) {
			exitCode = exitReason;
		}
	}

	if (error || signalCode || exitCode !== 0) {
		const description = command
			.map((arg) => (arg.includes(" ") ? `"${arg.replace(/"/g, '\\"')}"` : arg))
			.join(" ");
		const cause = error || stderr?.trim() || stdout?.trim() || undefined;

		if (signalCode) {
			error = new PError(`Command killed with ${signalCode}: ${description}`, {
				cause,
			});
		} else {
			error = new PError(
				`Command exited with code ${exitCode}: ${description}`,
				{ cause },
			);
		}
	}

	return {
		exitCode: exitCode as number,
		signalCode: signalCode as unknown as number,
		stdout,
		stderr,
		error: error as string,
		ok: exitCode === 0,
		timestamp: Date.now(),
		duration: (Date.now() - then).toString(),
	};
}

export function executeSyncSafe(
	command: string[],
	options: SpawnOptions,
): SpawnResult {
	const result = executeSync(command, options);

	const { error } = result;
	if (error) {
		throw error;
	}

	return result;
}

function parseCommand(command: string[], options: SpawnOptions) {
	if (options?.privileged) {
		return [...getPrivilegedCommand(), ...command];
	}
	return command;
}

let priviledgedCommand: string[] = [];
function getPrivilegedCommand(): string[] {
	if (typeof priviledgedCommand !== "undefined") {
		return priviledgedCommand;
	}

	if (isWindows) {
		return priviledgedCommand;
	}

	const sudo = ["sudo", "-n"];
	const { error: sudoError } = executeSync([...sudo, "true"]);
	if (!sudoError) {
		priviledgedCommand = sudo;
		return priviledgedCommand;
	}

	const su = ["su", "-s", "sh", "root", "-c"];
	const { error: suError } = executeSync([...su, "true"]);
	if (!suError) {
		priviledgedCommand = su;
		return priviledgedCommand;
	}

	const doas = ["doas", "-u", "root"];
	const { error: doasError } = executeSync([...doas, "true"]);
	if (!doasError) {
		priviledgedCommand = doas;
		return priviledgedCommand;
	}

	return priviledgedCommand;
}

export async function execute(
	command: string[],
	options: SpawnOptions = {},
): Promise<SpawnResult> {
	const [cmd, ...args] = parseCommand(command, options);
	const then = Date.now();
	debugLog("$", cmd, ...args);

	const stdin = options.stdin;
	const spawnOptions = {
		cwd: options.cwd ?? process.cwd(),
		timeout: options.timeout ?? undefined,
		env: options.env ?? undefined,
		stdio: [stdin ? "pipe" : "ignore", "pipe", "pipe"] as unknown as number[],
		...options,
	};

	let exitCode = 1;
	let signalCode: number | null | undefined;
	let stdout = "";
	let stderr = "";
	let error: Error | undefined;

	const result = new Promise<void>((resolve, reject) => {
		const subprocess = nodeSpawn(cmd, args, spawnOptions);

		if (typeof stdin !== "undefined") {
			subprocess.stdin?.on("error", (error: { code: string }) => {
				if (error.code !== "EPIPE") {
					reject(error);
				}
			});
			subprocess.stdin?.write(stdin);
			subprocess.stdin?.end();
		}

		subprocess.stdout?.on("data", (chunk: string) => {
			stdout += chunk;
		});
		subprocess.stderr?.on("data", (chunk: string) => {
			stderr += chunk;
		});

		subprocess.on("error", (error: unknown) => reject(error));
		subprocess.on("exit", (code: number, signal: typeof signalCode) => {
			exitCode = code;
			signalCode = signal;
			resolve();
		});
	});

	try {
		await result;
	} catch (cause) {
		error = cause as Error;
	}

	if (exitCode !== 0 && isWindows) {
		const exitReason = getWindowsExitReason(exitCode);
		if (exitReason) {
			exitCode = Number.parseInt(exitReason);
		}
	}

	if (error || signalCode || exitCode !== 0) {
		const description = command
			.map((arg) => (arg.includes(" ") ? `"${arg.replace(/"/g, '\\"')}"` : arg))
			.join(" ");
		const cause = error || stderr.trim() || stdout.trim() || undefined;

		if (signalCode) {
			error = new PError(`Command killed with ${signalCode}: ${description}`, {
				cause,
			});
		} else {
			error = new PError(
				`Command exited with code ${exitCode}: ${description}`,
				{ cause },
			);
		}
	}

	return {
		exitCode,
		signalCode,
		stdout,
		stderr,
		error: error as unknown as string,
		ok: exitCode === 0,
		timestamp: Date.now(),
		duration: (Date.now() - then).toString(),
	};
}
