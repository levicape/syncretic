import path from "node:path";
import type { CommandContext } from "@stricli/core";
import fs from "graceful-fs";
import { type Process, process } from "std-env";

export type AppContext = CommandContext & {
	process: Required<Process>;
	path: typeof path;
	fs: typeof fs;
	mkdirp: (path: string) => void;
};

export const CreateFourtwoContext = async () => {
	const _process: Required<Process> = process as Required<Process>;
	if (_process.stdin === undefined || _process.stdout === undefined) {
		throw new Error("CLI requires stdin/stdout");
	}

	return {
		process: _process,
		path,
		fs,
		mkdirp(dir: string) {
			try {
				fs.mkdirSync(dir, { recursive: true });
			} catch (e) {
				if (e instanceof Error) {
					if ("code" in e && e.code === "EEXIST") {
						return;
					}
				}
				throw e;
			}
		},
	} satisfies AppContext;
};
