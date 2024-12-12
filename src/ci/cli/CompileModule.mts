import { cpSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { Spawn } from "../cd/runner/Spawn.mjs";
import { debugLog } from "../machine/Debug.mjs";

const printDuration = (label: string, duration: number) => {
	if (duration > 60000) {
		debugLog(`${label} took ${(duration / 60000).toFixed(2)} minutes`);
	} else {
		debugLog(`${label} took ${(duration / 1000).toFixed(2)} seconds`);
	}
};

export type CompileModuleProps = {
	readonly root: string;
	readonly command: string;
	readonly artifact: string;
	readonly destination: string;
	readonly clean?: boolean;
};

export type CompileModuleSource = {
	name: string;
	path: string;
};

export type CompileModuleArtifact = {
	name: string;
	path: string;
	result: {
		stdout: string;
		stderr: string;
		exitCode: number;
	};
};

export type CompileModuleCopy = {
	name: string;
	from: string;
	to: string;
	clean: {
		enabled: boolean;
		result?: {
			stdout: string;
			stderr: string;
			exitCode: number;
		};
	};
	result: {
		stdout: string;
		stderr: string;
		exitCode: number;
	};
};

export type CompileModuleResult =
	| {
			$kind: "sources";
			sources: CompileModuleSource[];
	  }
	| {
			$kind: "artifacts";
			artifacts: CompileModuleArtifact[];
	  }
	| {
			$kind: "copies";
			copies: CompileModuleCopy[];
	  };

export async function list(cwd: string): Promise<CompileModuleSource[]> {
	const startTime = Date.now();
	const sources: CompileModuleSource[] = [];

	function* getDirectories(cwd: string, path: string) {
		const dirname = join(cwd, path);
		for (const entry of readdirSync(dirname, {
			encoding: "utf-8",
			withFileTypes: true,
		})) {
			const { name, parentPath } = entry;
			if (entry.isDirectory()) {
				yield {
					$kind: "directory" as const,
					name,
					path: join(parentPath, name),
				};
			}
		}

		return { $kind: "done", done: true } as const;
	}

	debugLog(`Listing directories in ${cwd}...`);
	// @ts-
	const iterator = getDirectories(cwd, "");
	for (let result = iterator.next(); !result.done; result = iterator.next()) {
		const { $kind } = result.value;
		if ($kind === "directory") {
			const { name, path } = result.value;
			sources.push({ name, path });
		}
	}

	printDuration("list", Date.now() - startTime);

	return sources;
}

export async function generate(
	{ name, path }: CompileModuleSource,
	{ root, command }: CompileModuleProps,
): Promise<CompileModuleArtifact> {
	const startTime = Date.now();
	debugLog(`Compiling ${name}...`);
	const executable = command.split(" ")[0];
	const args = command.split(" ").slice(1);
	let { exitCode, stdout, stderr } = await Spawn.spawnSafe({
		command: executable,
		args,
		cwd: `${resolve(root)}/${name}`,
		env: process.env,
	});
	printDuration(`compile ${name}`, Date.now() - startTime);

	(stdout ?? "").split("\n").forEach((line) => {
		const all = ["Command failed"];
		const fail = new RegExp(all.join("|"), "i");
		const error = fail.test(line.trim());
		if (error) {
			console.warn(
				{
					CompileModule: {
						generate: {
							message: "Error in stdout",
							name,
							path,
							stdout: line,
						},
					},
				},
				{ depth: null },
			);
			exitCode = 1;
		}
	});

	stderr = (stderr ?? "")
		.split("\n")
		.filter((line) => {
			const all = [
				`\\(node`,
				`Support for loading ES Module`,
				`\\(Use `,
				`npm warn`,
			];
			const ignored = new RegExp(all.join("|"), "i");
			const noderr = ignored.test(line.trim());
			if (noderr) {
				console.warn(
					{
						CompileModule: {
							generate: {
								message: "Ignoring error",
								name,
								path,
								stderr: line,
							},
						},
					},
					{ depth: null },
				);
			}
			return line.length > 0 && !noderr;
		})
		.map((line) => line.trim())
		.join("\n");

	exitCode = exitCode ?? 0;
	exitCode = stderr.length > 0 ? 1 : exitCode;

	return {
		name,
		path,
		result: {
			stdout,
			stderr: stderr ?? "",
			exitCode,
		},
	};
}

export async function copy(
	{ name, path }: CompileModuleArtifact,
	{ artifact, destination, clean }: CompileModuleProps,
): Promise<CompileModuleCopy> {
	const startTime = Date.now();

	let cleanout = "";
	let cleanerr = "";
	if (clean) {
		debugLog(`Cleaning ${name} from ${destination}...`);
		const to = join(destination, name);
		try {
			rmSync(to, { recursive: true });
			cleanout = `Cleaned ${to}`;
		} catch (error) {
			cleanerr = (error as unknown as { message: string }).message;
		}
	}

	debugLog(`Copying ${name} from ${artifact}...`);
	const from = join(path, artifact);
	const to = join(destination, name);
	let stdout = "";
	let stderr = "";

	try {
		cpSync(from, to, { recursive: true });
		stdout = `Copied ${from} to ${to}`;
	} catch (error) {
		stderr = (error as unknown as { message: string }).message;
	}

	printDuration(`copy ${name}`, Date.now() - startTime);

	return {
		name,
		from,
		to,
		result: {
			stdout,
			stderr,
			exitCode: stderr.length > 0 ? 1 : 0,
		},
		clean: {
			enabled: clean ?? false,
			result:
				cleanout.length > 0 || cleanerr.length > 0
					? {
							stdout: cleanout,
							stderr: cleanerr,
							exitCode: cleanerr.length > 0 ? 1 : 0,
						}
					: undefined,
		},
	};
}

export const CompileModule = async function* (
	props: CompileModuleProps,
): AsyncGenerator<CompileModuleResult, void, void> {
	const startTime = Date.now();

	const sources: CompileModuleSource[] = await list(props.root);
	yield {
		$kind: "sources",
		sources,
	};

	const artifacts: CompileModuleArtifact[] = [];
	for (const source of sources) {
		artifacts.push(await generate(source, props));
	}
	yield {
		$kind: "artifacts",
		artifacts,
	};

	const copies: CompileModuleCopy[] = [];
	const validArtifacts = artifacts.filter(
		(artifact) => artifact.result.exitCode === 0,
	);
	debugLog(`Copying ${validArtifacts.length} artifacts`);
	for (const artifact of validArtifacts) {
		copies.push(await copy(artifact, props));
	}

	printDuration("total", Date.now() - startTime);

	yield {
		$kind: "copies",
		copies,
	};
};
