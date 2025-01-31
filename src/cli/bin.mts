#!/usr/bin/env node --import tsx --no-deprecation --no-warnings
import { NodeRuntime } from "@effect/platform-node";
import { run } from "@stricli/core";
import { Context, Effect } from "effect";
import { process } from "std-env";
import VError from "verror";
import {
	LoggingContext,
	withStructuredLogging,
} from "../server/logging/LoggingContext.mjs";
import { AfterExit } from "./AfterExit.mjs";
import { FourtwoCliApp } from "./FourtwoCliApp.mjs";

const args = process.argv?.slice(2) ?? [];

NodeRuntime.runMain(
	Effect.provide(
		Effect.gen(function* () {
			const consola = yield* LoggingContext;
			const logger = yield* consola.logger;
			const app = yield* Effect.tryPromise(() => FourtwoCliApp());
			yield* Effect.tryPromise(async () => {
				if (process.stderr === undefined || process.stdout === undefined) {
					throw new VError("process.stderr or process.stdout is undefined");
				}
				const cleanargs = args.map((a, i) => {
					if (i > 0) {
						if (["--token"].includes(args[i - 1] ?? "")) {
							return "*****";
						}
					}
					return a;
				});
				logger
					.withMetadata({
						bin: {
							args: cleanargs,
						},
					})
					.info("Command execution started");
				await run(app, process.argv?.slice?.(2) ?? [], {
					process: {
						env: process.env,
						stderr: process.stderr,
						stdout: process.stdout,
						// @ts-ignore
						exit: (code: number) => {
							logger
								.withMetadata({
									bin: {
										args: cleanargs,
										code,
									},
								})
								.info("Command execution complete");

							if (code === 0) {
								let current: (() => void) | undefined;
								let pop = () => {
									current = AfterExit.commands.pop();
									current?.();
								};

								while (AfterExit.commands.length > 0) {
									pop();
								}

								// Add to event loop to ensure all commands are executed
								new Promise((resolve) => {
									setTimeout(resolve, 1000);
								}).then(() => {});
							} else {
								setImmediate(() => process.exit?.(code));
							}
						},
					},
				});
			});
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "CLI" })),
	),
);
