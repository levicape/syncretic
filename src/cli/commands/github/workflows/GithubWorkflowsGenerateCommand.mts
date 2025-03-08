import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildCommand } from "@stricli/core";
import VError from "verror";
import type { GithubWorkflowBuilder } from "../../../../ci/cd/pipeline/github/GithubWorkflowBuilder.mjs";
import { GenerateGithubWorkflow } from "../../../../ci/codegen/github/GenerateGithubWorkflow.mjs";
import { AfterExit } from "../../../AfterExit.mjs";

const isDirectory = (path: string) => {
	const resolved = resolve(path);
	const parent = dirname(resolved);
	return resolved !== parent;
};

type Flags = {
	import: string;
	output: boolean;
	write: boolean;
	path: string;
	strict?: boolean;
};

const fixExtension = ({ path, strict }: { path: string; strict?: boolean }) => {
	let updatedpath = path;
	if (path.endsWith(".jsx")) {
		if (strict) {
			throw new VError("Cannot use .jsx extension in strict mode");
		}

		console.warn({
			GenerateCommand: {
				message:
					"Using jsx file. Fourtwo will automatically convert the extension to .js. Use --strict to disable",
				path,
			},
		});
		updatedpath = path.replace(/\.jsx$/, ".js");
	}

	if (path.endsWith(".ts")) {
		if (strict) {
			throw new VError("Cannot use .ts extension in strict mode");
		}

		console.warn({
			GenerateCommand: {
				message:
					"Using ts file. Fourtwo will automatically convert the extension to .js. Use --strict to disable",
				path,
			},
		});
		updatedpath = path.replace(/\.ts$/, ".js");
	}

	if (path.endsWith(".tsx")) {
		if (strict) {
			throw new VError("Cannot use .tsx extension in strict mode");
		}

		console.warn({
			GenerateCommand: {
				message:
					"Using tsx file. Fourtwo will automatically convert the extension to .js. Use --strict to disable",
				path,
			},
		});
		updatedpath = path.replace(/\.tsx$/, ".js");
	}

	if (path.endsWith(".mjs")) {
		if (strict) {
			throw new VError("Cannot use .mjs extension in strict mode");
		}

		console.warn({
			GenerateCommand: {
				message:
					"Using mjs file. Fourtwo will automatically convert the extension to .js. Use --strict to disable",
				path,
			},
		});
		updatedpath = path.replace(/\.mjs$/, ".js");
	}

	if (path.endsWith(".cjs")) {
		if (strict) {
			throw new VError("Cannot use .cjs extension in strict mode");
		}

		console.warn({
			GenerateCommand: {
				message:
					"Using cjs file. Fourtwo will automatically convert the extension to .js. Use --strict to disable",
				path,
			},
		});
		updatedpath = path.replace(/\.cjs$/, ".js");
	}

	let lastpath = path.split("/").at(-1);
	let hasExtension = lastpath?.includes(".");
	if (!hasExtension) {
		if (strict) {
			throw new VError("Cannot use no extension in strict mode");
		}

		console.warn({
			GenerateCommand: {
				message:
					"Using no extension. Fourtwo will automatically convert the extension to .js. Use --strict to disable",
				path,
			},
		});
		updatedpath = `${path}.js`;
	}

	return updatedpath;
};

export const GithubWorkflowsGenerateCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (
					{ write, path, output, import: import_, strict }: Flags,
					target: string,
				) => {
					let source = `${process.cwd()}/${target}`;
					console.debug({
						GenerateCommand: {
							target,
							output,
							source,
						},
					});

					source = fixExtension({ path: source, strict });

					let workflows: Array<GithubWorkflowBuilder<string, string>> = (
						await import(source)
					)[import_] as unknown as Array<GithubWorkflowBuilder<string, string>>;

					switch (typeof workflows) {
						case "undefined":
							throw new VError(`Failed to import ${import_} from ${source}`);
						case "object":
							console.warn({
								GenerateCommand: {
									message:
										"Using object as workflow. It is recommended to instead export an async function that returns the GithubWorkflowX component, so that the build process can initialize",
								},
							});
							break;
						case "function":
							workflows = (
								workflows as () => Array<GithubWorkflowBuilder<string, string>>
							)();
							break;
					}

					if (workflows instanceof Promise) {
						workflows = await workflows;
					}

					if (!Array.isArray(workflows)) {
						workflows = [workflows];
					}

					for (const workflow of workflows) {
						const input = {
							workflow,
							source,
						};

						let generator = GenerateGithubWorkflow();

						console.debug({
							GenerateCommand: {
								message: "Starting workflow generation",
								generator,
							},
						});
						if ((await generator.next(input)).value.$state !== "workflow") {
							throw new VError("Failed to generate workflow");
						}

						let { value, done } = await generator.next(input);
						if (done || value.$state !== "content") {
							throw new VError(`Failed to generate workflow content: ${value}`);
						}

						let valid = false;
						if (output) {
							let content = value.content;
							AfterExit.execute(() => {
								if (!valid) {
									return;
								}
								process.stdout.write("\n");
								process.stdout.write(content);
							});
						}

						({ value, done } = await generator.next(input));
						if (done || value.$state !== "validate") {
							throw new VError(`Failed to validate workflow: ${value}`);
						}
						valid = true;

						({ value, done } = await generator.next(input));
						if (!done || value.$state !== "done") {
							valid = false;
							throw new VError(
								`Failed to finish workflow: ${JSON.stringify(value)}`,
							);
						}

						if (write) {
							const { filename, content, hashed } = value;
							let resolved = resolve(join(".", path));
							mkdirSync(resolved, { recursive: true });

							if (!isDirectory(resolved)) {
								throw new VError(`Failed to create directory: ${resolved}`);
							}

							let isSameHash = false;
							const file = join(resolved, filename);
							if (existsSync(file)) {
								const data = readFileSync(file, "ascii");
								const lines = data.split("\n");
								const meta = lines.filter((line: string) =>
									line.startsWith("#**:_$~-"),
								);
								if (meta.length > 0) {
									meta.forEach((hash) => {
										const parsed = JSON.parse(hash.split("#**:_$~- ")[1]);
										if (parsed.$$ === "body" && parsed.hashed === hashed) {
											isSameHash = true;
										}
									});
								}
							}

							if (!isSameHash) {
								writeFileSync(file, content);
								console.debug({
									GenerateCommand: {
										message: "Wrote workflow file",
										filename,
									},
								});
							} else {
								console.debug({
									GenerateCommand: {
										message: "Workflow file already exists",
										filename,
										hashed,
									},
								});
							}
						}
					}
				};
			},
			parameters: {
				positional: {
					kind: "tuple",
					parameters: [
						{
							brief: "File to serve",
							parse: (input: string) => {
								const allowed = ["js", "mjs", "cjs"];
								if (!allowed.some((ext) => input.endsWith(ext))) {
									throw new VError("File must be a js file (mjs, cjs)");
								}
								return input;
							},
						},
					],
				},
				flags: {
					import: {
						brief:
							'Export to use from target file. (Defaults to --import "default")',
						kind: "parsed",
						default: "default",
						parse: String,
					},
					output: {
						brief: "Output the generated workflow file to stdout",
						kind: "boolean",
						default: false,
					},
					path: {
						brief: "Path to write the generated workflow file",
						kind: "parsed",
						parse: (input: string) => {
							if (!isDirectory(input)) {
								throw new Error("Destination must be a directory");
							}
							return input;
						},
						default: ".github/workflows",
					},
					write: {
						brief: "Write the generated workflow file to the filesystem",
						kind: "boolean",
						default: false,
					},
				},
			},
			docs: {
				brief: "Generate a workflow file from an exported <GithubWorkflowX/>",
			},
		});
};
