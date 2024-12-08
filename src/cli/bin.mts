#!/usr/bin/env node --experimental-strip-types
import { run } from "@stricli/core";
import { FourtwoCliApp } from "./FourtwoCliApp.mjs";

const app = await FourtwoCliApp();
await run(app, process.argv.slice(2), {
	process: {
		...process,
		exit: (code: number) => {
			const args = process.argv.slice(2);
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

			if (code !== 0) {
				setImmediate(() => process.exit(code));
			}
		},
	},
});
