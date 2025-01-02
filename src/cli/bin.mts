#!/usr/bin/env node --import tsx --no-deprecation --no-warnings
import { run } from "@stricli/core";
import { FourtwoCliApp } from "./FourtwoCliApp.mjs";

export const AfterExit = {
	commands: [] as (() => void)[],
	execute(fn: () => void) {
		this.commands.push(fn);
	},
};

const ci = process.env.CI === "true";
const production = process.env.NODE_ENV === "production";
const app = await FourtwoCliApp();
const args = process.argv.slice(2);
const supress = ci || production;
const cleanargs = args.map((a, i) => {
	if (i > 0) {
		if (["--token"].includes(args[i - 1] ?? "")) {
			return "*****";
		}
	}
	return a;
});
!supress &&
	console.dir({
		Cli: {
			message: "Command execution started",
			args: cleanargs,
		},
	});
await run(app, process.argv.slice(2), {
	process: {
		...process,
		exit: (code: number) => {
			!supress &&
				console.dir({
					Cli: {
						message: "Command execution complete",
						args: cleanargs,
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
