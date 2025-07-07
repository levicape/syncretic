import { type StdioOptions, spawn } from "node:child_process";
import { appendFile, mkdtempSync, rmSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "../../machine/context/Filesystem.mjs";
import { isWindows } from "../../machine/context/System.mjs";
import type { RunnerOptions } from "./RunnerOptions.mjs";
import { Test, type TestResult } from "./Test.mjs";
import { parseTestStdout } from "./output.mjs";
import { getWindowsExitReason, parseDuration } from "./parse.mjs";
import { addPath } from "./path.mjs";

export interface SpawnResult {
	ok: boolean;
	error?: string;
	errors?: string;
	spawnError?: Error | null;
	exitCode?: number | null;
	signalCode?: number | null;
	timestamp: number;
	duration: string;
	stdout: string;
	stderr?: string;
	testPath?: string;
	status?: string;
}

export interface SpawnOptions {
	command?: string;
	args?: string[];
	cwd?: string;
	timeout?: number;
	env?: Record<string, string | undefined>;
	stdio?: StdioOptions;
	stdin?: (...props: unknown[]) => unknown;
	stdout?: (...props: unknown[]) => unknown;
	stderr?: (...props: unknown[]) => unknown;
	retries?: number;
	privileged?: boolean;
}

export class Spawn {
	static spawnNode = async (
		execPath: string,
		{ args, cwd, timeout, env, stdout, stderr }: SpawnOptions,
	): Promise<SpawnResult> => {
		// @ts-ignore
		const path = addPath(dirname(execPath), process.env.PATH);
		const tmpdirPath = mkdtempSync(join(tmpdir(), "nodetmp-"));
		const { username, homedir } = userInfo();
		const nodeEnv = {
			...process.env,
			PATH: path as string | undefined,
			Path: undefined as string | undefined,
			TEMP: undefined as string | undefined,
			TMPDIR: tmpdirPath,
			USER: username,
			HOME: homedir,
			FORCE_COLOR: "1",
			SHELLOPTS: isWindows ? "igncr" : undefined, // ignore "\r" on Windows
			// Used in Node.js tests.
			TEST_TMPDIR: tmpdirPath,
		};
		if (env) {
			Object.assign(nodeEnv, env);
		}
		if (isWindows) {
			nodeEnv.PATH = undefined;
			nodeEnv.Path = path;
			for (const tmpdir of ["TMPDIR", "TEMP", "TEMPDIR", "TMP"]) {
				// @ts-ignore
				delete nodeEnv[tmpdir];
			}
			nodeEnv.TEMP = tmpdirPath;
		}
		try {
			return await Spawn.spawnSafe({
				command: execPath,
				args,
				cwd,
				timeout,
				env: nodeEnv,
				stdout,
				stderr,
			});
		} finally {
			try {
				rmSync(tmpdirPath, { recursive: true, force: true });
			} catch (error) {
				console.warn(error);
			}
		}
	};
	static spawnNodeInstall = async (
		execPath: string,
		options: Pick<RunnerOptions, "cwd" | "timeouts">,
	): Promise<TestResult> => {
		const {
			timeouts: { testTimeout },
			cwd,
		} = options;
		const { ok, error, stdout, duration } = await Spawn.spawnNode(execPath, {
			args: ["install"],
			timeout: testTimeout,
			cwd,
		});
		const relativePath = relative(cwd, options.cwd);
		const testPath = join(relativePath, "package.json");
		const status = ok ? "pass" : "fail";
		return {
			testPath,
			ok,
			status,
			error: error ?? "",
			tests: [
				{
					file: testPath,
					test: "node install",
					status,
					duration: parseDuration(duration),
				},
			],
			stdout,
			stdoutPreview: stdout,
		};
	};
	static spawnNodeTest = async (
		execPath: string,
		testPath: string,
		options: Pick<RunnerOptions, "cwd"> & { args?: string[] },
	) => {
		const timeout = Test.getTestTimeout(testPath);
		const perTestTimeout = Math.ceil(timeout / 2);
		const absPath = join(options.cwd, testPath);
		const isReallyTest =
			Test.isTestStrict(testPath) || absPath.includes("vendor");
		const args = options.args ?? [];
		const { ok, error, stdout } = await Spawn.spawnNode(execPath, {
			args: isReallyTest
				? ["test", ...args, `--timeout=${perTestTimeout}`, absPath]
				: [...args, absPath],
			cwd: options.cwd,
			timeout: isReallyTest ? timeout : 30_000,
			env: {
				GITHUB_ACTIONS: "true", // always true so annotations are parsed
			},
			stdout: (data) => {
				appendFile(
					`/tmp/syncretic-runner.stdout.log`,
					data as string,
					() => {},
				);
			},
			stderr: (data) => {
				appendFile(
					`/tmp/syncretic-runner.stderr.log`,
					data as string,
					() => {},
				);
			},
		});
		const {
			tests,
			errors,
			stdout: stdoutPreview,
		} = parseTestStdout(stdout, testPath);
		return {
			testPath,
			ok,
			status: ok ? "pass" : "fail",
			error,
			errors,
			tests,
			stdout,
			stdoutPreview,
		};
	};

	static cleanLogs = async () => {
		try {
			rmSync(`/tmp/syncretic-runner.stdout.log`, {
				recursive: true,
				force: true,
			});
			rmSync(`/tmp/syncretic-runner.stderr.log`, {
				recursive: true,
				force: true,
			});
		} finally {
		}
	};

	static spawnSafe = async (options: SpawnOptions): Promise<SpawnResult> => {
		const {
			timeouts: { spawnTimeout },
			options: { "max-retries": maxRetries },
		} = {
			timeouts: { spawnTimeout: 12_000 },
			options: {
				"max-retries": "1",
			},
		};

		const {
			command,
			args,
			cwd,
			env,
			timeout = spawnTimeout,
			stdout = (data: string) => {
				appendFile(`/tmp/syncretic-runner.stdout.log`, data, () => {});
			},
			stderr = (data: string) => {
				appendFile(`/tmp/syncretic-runner.stderr.log`, data, () => {});
			},
			retries = 0,
		} = options;
		let exitCode: string | number | undefined = undefined;
		let signalCode: string | undefined = undefined;
		let spawnError:
			| { code: string; stack: string[]; message: string }
			| undefined = undefined;
		let timestamp = 0;
		let duration: number | undefined;
		let subprocess: {
			stderr: {
				destroy: () => void;
				on: (arg0: string, arg1: (chunk: string) => void) => void;
			};
			stdout: {
				destroy: () => void;
				on: (arg0: string, arg1: (chunk: string) => void) => void;
			};
			unref: () => void;
			killed: unknown;
			kill: (arg0: number) => void;
			on: (
				arg0: string,
				arg1: {
					(): void;
					(error: unknown): void;
					(code: number, signal: unknown): void;
				},
			) => void;
		};
		let timer: number | undefined;
		let buffer = "";
		let buffererror = "";
		let doneCalls = 0;
		const beforeDone = (resolve: {
			(value: unknown): void;
			(value: unknown): void;
		}) => {
			// TODO: wait for stderr as well, spawn.test currently causes it to hang
			if (doneCalls++ === 1) {
				// @ts-ignore
				done(resolve);
			}
		};
		const done = (resolve: {
			(value: unknown): void;
			(value: unknown): void;
			(value: unknown): void;
			(): void;
		}) => {
			if (timer) {
				clearTimeout(timer);
			}
			subprocess.unref();
			if (!signalCode && exitCode === undefined) {
				subprocess.stdout.destroy();
				subprocess.stderr.destroy();
				if (!subprocess.killed) {
					subprocess.kill(9);
				}
			}
			resolve();
		};
		await new Promise((resolve) => {
			try {
				subprocess = spawn(command ?? "", args ?? [], {
					stdio: ["ignore", "pipe", "pipe"],
					timeout,
					cwd,
					env,
				});
				// @ts-ignore
				subprocess.ref();
				// @ts-ignore
				const group = -subprocess.pid;

				subprocess.on("spawn", () => {
					timestamp = Date.now();
					// @ts-ignore
					timer = setTimeout(() => done(resolve), timeout);
				});
				// @ts-ignore
				subprocess.on("error", (error: typeof spawnError) => {
					spawnError = error;
					// @ts-ignore
					done(resolve);
				});
				// @ts-ignore
				subprocess.on("exit", (code: number, signal: typeof signalCode) => {
					if (!isWindows) {
						try {
							// @ts-ignore
							process.kill(group, "SIGTERM");
						} catch (error: unknown) {
							if ((error as typeof spawnError)?.code !== "ESRCH") {
								console.warn(error);
							}
						}
					}

					duration = Date.now() - timestamp;
					exitCode = code;
					signalCode = signal;
					if (signalCode || exitCode !== 0) {
						beforeDone(resolve);
					} else {
						// @ts-ignore
						done(resolve);
					}
				});
				subprocess.stdout.on("end", () => {
					beforeDone(resolve);
				});
				// @ts-ignore
				subprocess.stdout.on(
					"data",
					(chunk: { toString: (arg0: string) => string }) => {
						const text = chunk.toString("utf-8");
						stdout?.(text);
						buffer += text;
					},
				);
				subprocess.stderr.on(
					"data",
					(chunk: { toString: (arg0: string) => string }) => {
						const text = chunk.toString("utf-8");
						stderr?.(text);
						buffererror += text;
					},
				);
			} catch (error) {
				spawnError = error as unknown as typeof spawnError;
				// @ts-ignore
				resolve();
			}
		});

		const max = Number.parseInt(maxRetries);
		if (spawnError && retries < max) {
			const { code } = spawnError;
			if (code === "EBUSY" || code === "UNKNOWN") {
				await new Promise((resolve) =>
					setTimeout(resolve, 1000 * (retries + 1)),
				);
				return Spawn.spawnSafe({
					...options,
					retries: retries + 1,
				});
			}
		}
		let error: string | RegExpExecArray | never[] | null = null;
		if (exitCode === 0) {
			// ...
		} else if (spawnError) {
			const { stack, message } = spawnError;
			if (/timed? ?out/.test(message)) {
				error = "timeout";
			} else {
				error = "spawn error";
				buffererror = (stack as unknown as string) || message;
			}
		} else if (
			(error = /thread \d+ panic: (.*)(?:\r\n|\r|\n|\\n)/i.exec(buffererror)) ||
			(error = /panic\(.*\): (.*)(?:\r\n|\r|\n|\\n)/i.exec(buffererror)) ||
			(error = /(Segmentation fault) at address/i.exec(buffererror)) ||
			(error = /(Internal assertion failure)/i.exec(buffererror)) ||
			(error = /(Illegal instruction) at address/i.exec(buffererror)) ||
			(error = /panic: (.*) at address/i.exec(buffererror))
		) {
			const [, message] = error || [];
			error = message ? message.split("\n")[0].toLowerCase() : "crash";
			error =
				error.indexOf("\\n") !== -1
					? error.substring(0, error.indexOf("\\n"))
					: error;
		} else if (signalCode) {
			if (
				signalCode === "SIGTERM" &&
				duration !== undefined &&
				duration >= timeout
			) {
				error = "timeout";
			} else {
				error = signalCode;
			}
		} else if (exitCode === 1) {
			const match = buffererror.match(/\x1b\[31m\s(\d+) fail/);
			if (match) {
				error = `${match[1]} failing`;
			} else {
				error = "code 1";
			}
		} else if (exitCode === undefined) {
			error = "timeout";
		} else if (exitCode !== 0) {
			if (isWindows) {
				const winCode = getWindowsExitReason(exitCode as number);
				if (winCode) {
					exitCode = winCode;
				}
			}
			error = `code ${exitCode}`;
		}
		return {
			ok: (exitCode as unknown as number) === 0 && !signalCode && !spawnError,
			error: error !== null ? (error as string) : undefined,
			exitCode: exitCode as unknown as number,
			signalCode: signalCode as unknown as number,
			spawnError: spawnError as unknown as Error | null,
			stdout: buffer,
			stderr: buffererror,
			timestamp: timestamp || Date.now(),
			duration: duration?.toString() ?? "0",
		};
	};
}
