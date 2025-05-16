import { cp } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { confirm, input, select } from "@inquirer/prompts";
import { buildApplication, buildCommand } from "@stricli/core";
import { createSpinner } from "nanospinner";
import * as picocolors from "picocolors";
import packageJson from "../package.json" with { type: "json" };
import type { AppContext } from "./context.mts";
import { type CliResource, CliTemplateIds } from "./templates.mts";

const { bold, green } = picocolors;
const { description, version, name } = packageJson;

export type CreateFourtwoAppFlags = {
	resource?: CliResource;
	offline: boolean;
};

export const CreateFourtwoApp = async () => {
	return buildApplication(
		buildCommand({
			async func(
				this: AppContext,
				flags: CreateFourtwoAppFlags,
				path?: string,
			) {
				const { resource, offline } = flags;
				console.log(`Creating fourtwo jsx resource`);

				const templateName =
					resource ||
					((await select({
						loop: true,
						message: "Which template do you want to use?",
						choices: CliTemplateIds.map((template) => ({
							title: template,
							value: template,
						})),
						default: 0,
					})) as CliResource);

				if (!templateName) {
					throw new Error("No template selected");
				}

				let target = "";
				if (path) {
					target = path;
					console.log(
						`${bold(`${green("✔")} Using target directory`)} … ${target}`,
					);
				} else {
					const answer = await input({
						message: "Target directory",
						default: templateName ? `jsx-${templateName}` : "jsx-resource",
					});
					target = answer;
				}

				let projectName = "";
				const isCurrentDirRegex = /^(\.\/|\.\\|\.)$/;
				if (isCurrentDirRegex.test(target)) {
					projectName = this.path.basename(this.process.cwd());
				} else {
					projectName = this.path.basename(target);
				}
				if (!CliTemplateIds.includes(templateName)) {
					throw new Error(`Invalid template selected: ${templateName}`);
				}

				if (this.fs.existsSync(target)) {
					if (this.fs.readdirSync(target).length > 0) {
						const response = await confirm({
							message: "Directory not empty. Continue?",
							default: false,
						});
						if (!response) {
							this.process.exit(1);
						}
					}
				} else {
					this.mkdirp(target);
				}

				const targetDirectoryPath = this.path.join(this.process.cwd(), target);
				try {
					const spinner = createSpinner("Creating resource").start();
					const __filename = fileURLToPath(import.meta.url);
					const __dirname = dirname(__filename);

					const from = resolve(__dirname, "../template");

					await cp(join(from, templateName), targetDirectoryPath, {
						recursive: true,
						dereference: true,
						filter: (src) => {
							const basename = this.path.basename(src);
							if (basename === "node_modules") {
								return false;
							}
							if (basename === ".git") {
								return false;
							}
							return true;
						},
					});
					spinner.success();
				} catch (e) {
					throw new Error(
						`Error running hook for ${templateName}: ${
							e instanceof Error ? e.message : e
						}`,
					);
				}

				const packageJsonPath = this.path.join(
					targetDirectoryPath,
					"package.json",
				);

				if (this.fs.existsSync(packageJsonPath)) {
					const packageJson = this.fs.readFileSync(packageJsonPath, "utf-8");

					const packageJsonParsed = JSON.parse(packageJson);
					const newPackageJson = {
						name: projectName,
						...packageJsonParsed,
					};

					this.fs.writeFileSync(
						packageJsonPath,
						JSON.stringify(newPackageJson, null, 2),
					);
				}
			},
			parameters: {
				positional: {
					kind: "tuple",
					parameters: [
						{
							brief: "Target path of new package directory",
							parse(rawInput) {
								return this.path.join(this.process.cwd(), rawInput);
							},
							placeholder: "path",
							optional: true,
						},
					],
				},
				flags: {
					resource: {
						kind: "enum",
						brief: "Resource to create",
						values: CliTemplateIds,
						optional: true,
					},
					offline: {
						kind: "boolean",
						brief: "Offline mode",
						default: false,
					},
				},
			},
			docs: {
				brief: description,
			},
		}),
		{
			name,
			versionInfo: {
				currentVersion: version,
			},
			scanner: {
				caseStyle: "allow-kebab-for-camel",
			},
			documentation: {
				useAliasInUsageLine: true,
			},
		},
	);
};
