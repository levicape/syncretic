import {
	type ExecSyncOptions,
	type SpawnSyncOptions,
	execSync,
} from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	ComponentResource,
	type ComponentResourceOptions,
	type Output,
} from "@pulumi/pulumi/index.js";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { hashElement } from "folder-hash";
import type { Context } from "../../context/Context.js";
import type { ComputeComponentBuildResult } from "../compute/ComputeComponent.js";
import type { RouteMap } from "./WebsiteManifest.js";

export interface WebsiteComponentBuildProps {
	root: string;
	copyFrom?: string;
	indexHtmlPath?: string;
	errorHtmlPath?: string;
	useDocker?: boolean;
	layer?: ComputeComponentBuildResult;
}

export interface WebsiteComponentBuildResult {
	wwwroot: string;
	indexHtmlPath: string;
	errorHtmlPath: string;
}

export interface WebsiteComponentProps {
	context: Context;
	build: WebsiteComponentBuildResult;
	routes?: Output<RouteMap>;
	blockPublic?: boolean;
	rootOnly?: boolean;
}

const TEMP_FOLDER = `build/website`;

export class WebsiteComponent extends ComponentResource {
	constructor(
		urn: string,
		name: string,
		_: WebsiteComponentProps,
		opts?: ComponentResourceOptions,
	) {
		super(urn, name, {}, opts);
	}

	static async build(
		context: Context,
		{
			root,
			copyFrom,
			indexHtmlPath,
			errorHtmlPath,
			useDocker = false, // Default to false if not specified
			layer,
		}: WebsiteComponentBuildProps,
	): Promise<WebsiteComponentBuildResult> {
		const directory = path.resolve(process.cwd(), root);
		const rootId = root.replaceAll("/", "_").replaceAll("..", "");
		const buildId = (
			await hashElement(directory, {
				encoding: "base64url",
				folders: {
					exclude: [
						".*",
						"node_modules",
						"test_coverage",
						`${copyFrom ?? "build"}`,
						"build",
					],
				},
				files: {
					include: [
						...["ts", "js", "jsx", "tsx", "json", "css", "scss", "map"].flatMap(
							(extension) => [`*.${extension}`, `**/*.${extension}`],
						),
						"package.json",
					],
				},
			})
		).hash;
		const copyTo = `./${TEMP_FOLDER}/${rootId}/${buildId}`;
		console.time(copyTo);
		console.debug({
			WebsiteComponent: {
				build: {
					buildId,
					directory,
					copyTo,
				},
				args: {
					root,
					copyFrom,
					indexHtmlPath,
					errorHtmlPath,
				},
			},
		});
		copyFrom = copyFrom ?? "build";
		indexHtmlPath = indexHtmlPath ?? "index.html";
		errorHtmlPath = errorHtmlPath ?? "error.html";

		if (layer) {
			mkdirSync(copyTo, { recursive: true });
			execSync(`cp -r ${layer.root}/${copyFrom} ${copyTo}`);

			return {
				wwwroot: copyTo,
				indexHtmlPath,
				errorHtmlPath,
			};
		}
		if (useDocker) {
			await WebsiteComponent.buildWithDocker(
				directory,
				copyTo,
				copyFrom,
				indexHtmlPath,
				errorHtmlPath,
			);
		} else {
			await WebsiteComponent.buildWithShell(
				directory,
				copyTo,
				copyFrom,
				indexHtmlPath,
				errorHtmlPath,
				context,
			);
		}

		console.timeEnd(copyTo);

		return {
			wwwroot: copyTo,
			indexHtmlPath,
			errorHtmlPath,
		};
	}

	static async buildWithDocker(
		directory: string,
		copyTo: string,
		copyFrom: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_: string, // indexHtmlPath
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		__: string, // errorHtmlPath
	): Promise<void> {
		const dockerfilePath = path.join(directory, "Dockerfile");
		const dockerfileContent = `
      FROM node:20
      WORKDIR /app
      COPY package*.json ./
      RUN npm install
      COPY . .
      RUN npm run build
    `;
		mkdirSync(path.dirname(dockerfilePath), { recursive: true });
		writeFileSync(dockerfilePath, dockerfileContent);

		console.debug(`Building Docker image using ${dockerfilePath}`);
		execSync(
			`docker build -t website-build -f ${dockerfilePath} ${directory}`,
			{ stdio: "inherit" },
		);

		console.debug(`Copying build artifacts from Docker container to ${copyTo}`);
		execSync(
			`docker run --rm -v ${copyTo}:/output website-build cp -r /app/${copyFrom} /output`,
			{ stdio: "inherit" },
		);
	}

	private static async buildWithShell(
		directory: string,
		copyTo: string,
		copyFrom: string,
		_: string, // indexHtmlPath
		__: string, // errorHtmlPath
		context: Context,
	): Promise<void> {
		const spawnArgs: SpawnSyncOptions & ExecSyncOptions = {
			encoding: "ascii",
		};

		if (isDryRun()) {
			try {
				console.debug({
					WebsiteComponent: {
						buildId: "shell_build",
						step: "VERIFY ROOT",
						directory,
						out: execSync(`cd ${directory}; pwd; ls;`, spawnArgs),
					},
				});
				console.debug({
					WebsiteComponent: {
						buildId: "shell_build",
						step: "INSTALL DEPENDENCIES",
						directory,
						out: execSync(`cd ${directory}; pwd; npm install;`, spawnArgs),
					},
				});
				console.debug({
					WebsiteComponent: {
						buildId: "shell_build",
						step: "RUN BUILD",
						directory,
						out: execSync(
							`cd ${directory}; npm run build -- --minify ${context.environment.isProd ? "true" : "false"};`,
							spawnArgs,
						),
					},
				});
				console.debug({
					WebsiteComponent: {
						buildId: "shell_build",
						step: "CREATE_WWWROOT",
						copyTo,
						out: mkdirSync(copyTo, { recursive: true }),
					},
				});
				console.debug({
					WebsiteComponent: {
						buildId: "shell_build",
						step: "COPY",
						directory,
						copyFrom,
						copyTo,
						out: cpSync(`${directory}/${copyFrom}`, copyTo, {
							recursive: true,
						}),
					},
				});
			} catch (error) {
				console.error({
					WebsiteComponent: {
						buildId: "shell_build",
						error: {
							error,
							string: error?.toString(),
							json: JSON.stringify(error),
						},
					},
				});

				throw error;
			}

			console.debug({
				WebsiteComponent: {
					buildId: "shell_build",
					step: "CONFIRM",
					copyTo,
					out: execSync(`pwd; cd ${copyTo}; pwd; ls;`, spawnArgs),
				},
			});
		}
	}
}
