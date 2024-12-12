import { dirname, resolve } from "node:path";
import { buildCommand } from "@stricli/core";
import VError from "verror";
import type { GithubPipelineBuilder } from "../../../../ci/cd/pipeline/github/GithubPipelineBuilder.mjs";
import { GenerateGithubPipeline } from "../../../../ci/codegen/github/GenerateGithubNode.mjs";
import { AfterExit } from "../../../bin.mjs";

export const isDirectory = (path: string) => {
	const resolved = resolve(path);
	const parent = dirname(resolved);
	return resolved !== parent;
};

type Flags = {
	import: string;
	output: boolean;
	filename?: string;
};

export const GenerateCommand = async () => {
	return async () =>
		buildCommand({
			loader: async () => {
				return async (
					{ filename, output, import: import_ }: Flags,
					target: string,
				) => {
					const path = `${process.cwd()}/${target}`;
					console.debug({
						GenerateCommand: {
							target,
							output,
							path,
						},
					});
					const pipeline: GithubPipelineBuilder<string, string> = (
						await import(path)
					)[import_] as unknown as GithubPipelineBuilder<string, string>;

					let generator = GenerateGithubPipeline();

					console.debug({
						GenerateCommand: {
							message: "Starting pipeline generation",
							generator,
						},
					});
					if ((await generator.next(pipeline)).value.$state !== "pipeline") {
						throw new VError("Failed to generate pipeline");
					}

					let { value, done } = await generator.next(pipeline);
					if (done || value.$state !== "content") {
						throw new VError(`Failed to generate pipeline content: ${value}`);
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

					({ value, done } = await generator.next(pipeline));
					if (done || value.$state !== "validate") {
						throw new VError(`Failed to validate pipeline: ${value}`);
					}
					valid = true;

					({ value, done } = await generator.next(pipeline));
					if (!done || value.$state !== "done") {
						valid = false;
						throw new VError(
							`Failed to finish pipeline: ${JSON.stringify(value)}`,
						);
					}

					if (filename) {
						console.log({
							GenerateCommand: {
								message: "Writing to file",
								filename,
							},
						});
					}

					// Validate
					// Configure runs-on
					// Verify envs
					// Report
					// Write file

					// if (copies !== undefined && copies.$kind === "copies") {
					// 	const failedCopies = copies.copies.filter(
					// 		(copy) => copy?.result.exitCode !== 0,
					// 	);
					// 	if (failedCopies.length > 0) {
					// 		console.warn({
					// 			GenerateCommand: {
					// 				message: "Failed to copy artifacts",
					// 				copies: failedCopies,
					// 			},
					// 		});
					// 	}

					// 	if (failedCopies.length === copies.copies.length) {
					// 		throw new Error("All copies failed to generate");
					// 	}
					// }

					// const { done } = await compileModule.next();
					// if (!done) {
					// 	console.warn({
					// 		GenerateCommand: {
					// 			message: "CompileModule did not finish, please verify",
					// 		},
					// 	});

					// 	throw new Error("CompileModule did not finish");
					// }
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
									throw new Error("File must be a js file (mjs, cjs)");
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
					filename: {
						brief: "Filename of the generated workflow file",
						kind: "parsed",
						parse: (input: string) => {
							if (!isDirectory(input)) {
								throw new Error("Destination must be a directory");
							}
							return input;
						},
						optional: true,
					},
				},
			},
			docs: {
				brief: "Generate a workflow file from an exported <GithubPipelineX/>",
			},
		});
};
