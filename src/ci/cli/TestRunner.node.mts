#!/usr/bin/env node --experimental-strip-types
import { spawnSync } from "node:child_process";
import {
	appendFile,
	appendFileSync,
	createReadStream,
	existsSync,
	rmSync,
} from "node:fs";
import * as os from "node:os";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import { getRunnerOptions, setRunnerCwd } from "../cd/runner/RunnerOptions.mjs";
import { RunnerTests } from "../cd/runner/RunnerTests.mjs";
import { Spawn } from "../cd/runner/Spawn.mjs";
import type { TestResult, VendorTest } from "../cd/runner/Test.mjs";
import {
	formatTestToMarkdown,
	reportOutputToGitHubAction,
} from "../cd/runner/output.mjs";
import { getAnsi, getExitCode } from "../cd/runner/parse.mjs";
import { getExecPath } from "../cd/runner/path.mjs";
import { getRevision } from "../machine/code/Git.mjs";
import { isCI } from "../machine/context/Compute.mjs";
import {
	printEnvironment,
	startGroup,
} from "../machine/context/Environment.mjs";
import {
	getExecPathFromBuildKite,
	isBuildkite,
	reportAnnotationToBuildKite,
} from "../machine/executor/Buildkite.mjs";
import { isGithubAction } from "../machine/executor/GithubActions.mjs";

const cpuCount = Math.ceil(os.cpus().length - 1) * 96;
export type RunnerRunSummary = {
	success: number;
	fail: TestResult[];
};
export class RunnerRunTests {
	static runTests = async (): Promise<RunnerRunSummary> => {
		const { timeouts, testsPath, cwd, options } = getRunnerOptions();
		const { spawnTimeout } = timeouts;

		let execPath: string = getExecPath(options["exec-path"]);
		if (options.step) {
			downloadLoop: for (let i = 0; i < 10; i++) {
				execPath = await getExecPathFromBuildKite(options.step);
				for (let j = 0; j < 10; j++) {
					const { error } = spawnSync(execPath, ["--version"], {
						encoding: "utf-8",
						timeout: spawnTimeout,
						env: {
							PATH: process.env.PATH,
							BUN_DEBUG_QUIET_LOGS: "1",
						},
					});
					if (!error) {
						break downloadLoop;
					}
					const { code } = error as Error & { code: string };
					if (code === "EBUSY") {
						console.log("Bun appears to be busy, retrying...");
						continue;
					}
					if (code === "UNKNOWN") {
						console.log("Bun appears to be corrupted, downloading again...");
						rmSync(execPath, { force: true });
						continue downloadLoop;
					}
				}
			}
		}
		console.log("Bun:", execPath);

		const revision = getRevision({ execPath, spawnTimeout });
		console.log("Revision:", revision);

		const tests = RunnerTests.getRelevantTests(testsPath);
		console.log("Running tests:", tests.length);

		let vendorTests: VendorTest[] | undefined;
		let vendorTotal = 0;
		if (
			/true|1|yes|on/i.test(options.vendor) ||
			(isCI && typeof options.vendor === "undefined")
		) {
			vendorTests = await RunnerTests.getVendorTests(cwd);
			if (vendorTests?.length) {
				vendorTotal = vendorTests.reduce(
					(total, { testPaths }) => total + testPaths.length + 1,
					0,
				);
				console.log("Running vendor tests:", vendorTotal);
			}
		}

		let i = 0;
		const total = vendorTotal + tests.length + 2;

		const numCores = Math.max(1, cpuCount);
		const partitionSize = Math.ceil(tests.length / numCores);
		const partitions: number = Math.ceil(tests.length / partitionSize);
		const filepath = (partition: string | number) =>
			`/tmp/bun-runner.${partition}.resultcache.json`;
		for (let i = 0; i < partitions; i++) {
			try {
				rmSync(filepath(i));
			} catch (_) {}
		}
		const maxAttempts = options["max-attempts"]
			? Number.parseInt(options["max-attempts"])
			: 1;
		const runTest = async (
			title: string,
			fn: () => Promise<TestResult>,
			partition = 0,
		): Promise<TestResult> => {
			const label = `${getAnsi("gray")}[${++i}/${total}]${getAnsi("reset")} ${title}`;
			const result: TestResult = await startGroup(label, async () => {
				let inner: ReturnType<typeof fn>;
				let result: Awaited<typeof inner>;
				let attempts = 0;
				const executions: (typeof inner)[] = [];
				do {
					attempts++;
					inner = fn();
					if (inner instanceof Promise) {
						result = (await inner) ?? undefined;
					} else {
						result = inner;
					}

					if (result !== undefined) {
						if (result.ok) {
							break;
						}
						executions.push(inner);
					} else {
						throw Error("Unable to retrieve test results");
					}
				} while (attempts <= maxAttempts);
				return Promise.resolve({ ...result, executions, attempts, partition });
			});

			appendFile(filepath(partition), `${JSON.stringify(result)}\n`, () => {});

			if (isBuildkite) {
				const { ok, error, stdoutPreview } = result;
				if (title.startsWith("vendor")) {
					const markdown = formatTestToMarkdown({ ...result, testPath: title });
					if (markdown) {
						reportAnnotationToBuildKite({
							label: title,
							content: markdown,
							style: "warning",
							priority: 5,
						});
					}
				} else {
					const markdown = formatTestToMarkdown(result);
					if (markdown) {
						reportAnnotationToBuildKite({
							label: title,
							content: markdown,
							style: "error",
						});
					}
				}

				if (!ok) {
					const label = `${getAnsi("red")}[${i}/${total}] ${title} - ${error}${getAnsi("reset")}`;
					startGroup(label, () => {
						// @ts-ignore
						process.stderr.write(stdoutPreview);
					});
				}
			}

			if (isGithubAction) {
				const summaryPath = process.env.GITHUB_STEP_SUMMARY;
				if (summaryPath) {
					const longMarkdown = formatTestToMarkdown(result);
					appendFileSync(summaryPath, longMarkdown);
				}
				const shortMarkdown = formatTestToMarkdown(result, true);
				appendFileSync("comment.md", shortMarkdown);
			}

			if (options.bail && !result.ok) {
				// @ts-ignore
				process.exit(getExitCode("fail"));
			}

			return result;
		};

		const installs: Partial<TestResult>[] = [];
		for (const path of [cwd, testsPath]) {
			const title = relative(cwd, join(path, "package.json")).replace(
				/\\/g,
				"/",
			);
			const install = await runTest(title, async () =>
				Spawn.spawnBunInstall(execPath, { cwd: path, timeouts }),
			);
			installs.push(install);
		}

		if (installs.every(({ ok }) => ok)) {
			const processes: Array<Promise<void>> = [];
			let left = 0;
			let right = partitionSize;
			while (processes.length < numCores) {
				const partition = tests.slice(
					left,
					right > tests.length ? tests.length : right,
				);
				left += partitionSize;
				right += partitionSize;

				const processNum = processes.length;
				processes.push(
					(async () => {
						console.log({
							partition: partition.length,
							tests: tests.length,
							partitionSize,
							processes: processes.length,
						});
						for (const testPath of partition) {
							const title = relative(cwd, join(testsPath, testPath)).replace(
								/\\/g,
								"/",
							);
							await runTest(
								title,
								async () =>
									Spawn.spawnBunTest(execPath, join("test", testPath), {
										cwd,
									}),
								processNum,
							);
						}
					})(),
				);
			}
			await Promise.allSettled(processes);
		}

		if (vendorTests?.length) {
			for (const {
				cwd: vendorPath,
				packageManager,
				testRunner,
				testPaths,
			} of vendorTests) {
				if (!testPaths.length) {
					continue;
				}

				const packageJson = join(
					relative(cwd, vendorPath),
					"package.json",
				).replace(/\\/g, "/");
				if (packageManager === "bun") {
					const { ok } = await runTest(packageJson, () =>
						Spawn.spawnBunInstall(execPath, { cwd: vendorPath, timeouts }),
					);
					if (!ok) {
						continue;
					}
				} else {
					throw new Error(`Unsupported package manager: ${packageManager}`);
				}

				const processes: Array<Promise<void>> = [];
				let left = 0;
				let right = partitionSize;
				while (processes.length < numCores) {
					const partition = testPaths.slice(
						left,
						right > testPaths.length ? testPaths.length : right,
					);
					left += partitionSize;
					right += partitionSize;

					const processNum = processes.length;
					processes.push(
						(async () => {
							console.log({
								partition: partition.length,
								tests: testPaths.length,
								partitionSize,
								processes: processes.length,
							});
							for (const testPath of partition) {
								const title = relative(cwd, join(testsPath, testPath)).replace(
									/\\/g,
									"/",
								);
								if (testRunner === "bun") {
									await runTest(
										title,
										() =>
											Spawn.spawnBunTest(execPath, testPath, {
												cwd: vendorPath,
											}),
										processNum,
									);
								} else {
									const testRunnerPath = join(
										cwd,
										"test",
										"runners",
										`${testRunner}.ts`,
									);
									if (!existsSync(testRunnerPath)) {
										throw new Error(`Unsupported test runner: ${testRunner}`);
									}
									await runTest(
										title,
										async () =>
											Spawn.spawnBunTest(execPath, join("test", testPath), {
												cwd: vendorPath,
												args: ["--preload", testRunnerPath],
											}),
										processNum,
									);
								}
							}
						})(),
					);
				}
				await Promise.allSettled(processes);
			}
		}

		const summary: RunnerRunSummary = {
			success: 0,
			fail: [],
		};
		for (let i = 0; i <= partitions; i++) {
			const fileStream = createReadStream(filepath(i));
			const reader = createInterface({
				input: fileStream,
				crlfDelay: Number.POSITIVE_INFINITY,
			});

			for await (const line of reader) {
				const result: TestResult = JSON.parse(line.trim());
				if (result.ok) {
					summary.success++;
				} else {
					summary.fail.push(result);
				}
			}
			// rmSync(filepath(i));
		}

		const failedTests = summary.fail;
		if (isGithubAction) {
			reportOutputToGitHubAction(
				"failing_tests_count",
				failedTests.length.toString(),
			);
			const markdown = formatTestToMarkdown(failedTests);
			reportOutputToGitHubAction("failing_tests", markdown);
		}

		if (!isCI) {
			console.log("-------");
			console.log(
				"passing",
				summary.success - failedTests.length,
				"/",
				summary.success,
			);
			for (const { testPath } of failedTests) {
				console.log("-", testPath);
			}
		}
		return summary;
	};
}

/**
 * @param {string} signal
 */
function onExit(signal: string) {
	const label = `${getAnsi("red")}Received ${signal}, exiting...${getAnsi("reset")}`;
	startGroup(label, () => {
		// @ts-ignore
		process.exit(getExitCode("cancel"));
	});
}

export const TestRunner = async () =>
	await (async () => {
		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
			// @ts-ignore
			process.on(signal, () => onExit(signal));
		}
		// @ts-ignore
		setRunnerCwd(process.cwd());
		await Spawn.cleanLogs();

		printEnvironment();
		return await RunnerRunTests.runTests();
	})().then((results) => {
		const ok = results.fail.length === 0;
		if (!ok) {
			// @ts-ignore
			process.exit(getExitCode("fail"));
		}
	});
