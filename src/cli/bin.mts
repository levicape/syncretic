#!/usr/bin/env node --import tsx --no-deprecation --no-warnings --experimental-strip-types
import { run } from "@stricli/core";
import { FourtwoCliApp } from "./FourtwoCliApp.mjs";

export const AfterExit = {
	commands: [] as (() => void)[],
	execute(fn: () => void) {
		this.commands.push(fn);
	},
};

const production = process.env.NODE_ENV === "production";
!production &&
	console.dir({
		Cli: {
			message: "Command execution started",
			args: process.argv.slice(2),
		},
	});
const app = await FourtwoCliApp();
await run(app, process.argv.slice(2), {
	process: {
		...process,
		exit: (code: number) => {
			const args = process.argv.slice(2);
			!production &&
				console.dir({
					Cli: {
						message: "Command execution complete",
						args: args.map((a, i) => {
							if (i > 0) {
								if (["--token"].includes(args[i - 1] ?? "")) {
									return "*****";
								}
							}
							return a;
						}),
						code,
					},
				});

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
				setImmediate(() => process.exit(code));
			}
		},
	},
});
