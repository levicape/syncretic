import { type ExecSyncOptions, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { hashElement } from "folder-hash";
import type { Context } from "../../../../context/Context.js";
import {
	ComputeComponent,
	type ComputeComponentBuildProps,
	type ComputeComponentBuildResult,
} from "../ComputeComponent.js";
import type {
	ProtocolComponentBuildResult,
	ProtocolMap,
} from "../protocol/ProtocolComponent.js";

type CopyFrom = ComputeComponentBuildProps["copyFrom"];

export type NodejsComponentBuildProps<
	Protocols extends ProtocolMap<
		string,
		ProtocolComponentBuildResult
	> = ProtocolMap<string, ProtocolComponentBuildResult>,
> = {
	nodeVersion: string;
	protocolLanguage?: "node" | "typescript" | "web";
} & ComputeComponentBuildProps<Protocols>;

export type NodejsComponentBuildResult = {
	nodeVersion: string;
} & ComputeComponentBuildResult;

type PackageManager = {
	command: string;
};
const PACKAGE_MANAGERS: Record<string, PackageManager> = {
	npm: {
		command: "npm",
	},
	pnpm: {
		command: "pnpm",
	},
};
export class NodejsComponent extends ComputeComponent {
	static readonly URN: `compute:${string}::nodejs` = "compute:*::nodejs";

	static PACKAGE_MANAGER: PackageManager = PACKAGE_MANAGERS.npm;
	static async build<
		Protocols extends ProtocolMap<string, ProtocolComponentBuildResult>,
	>(
		{ environment }: Context,
		props: NodejsComponentBuildProps<Protocols>,
	): Promise<NodejsComponentBuildResult> {
		const {
			copyFrom,
			srcRoot,
			executor,
			envs,
			nodeVersion = "22",
			artifact = "build",
			protocols,
			protocolLanguage = "typescript",
		} = {
			...props,
			envs: props.envs ?? {},
		};

		const rootId = (copyFrom.git?.url ?? copyFrom.local?.path ?? "void")
			.replaceAll("/", "_")
			.replaceAll(":", "-")
			.replaceAll("..", "");
		const buildId = await NodejsComponent.getSourceIdentifier(copyFrom);
		const tempDir = path.join(
			process.cwd(),
			"build",
			"temp",
			"build",
			"compute",
			"nodejs",
			rootId,
			buildId,
		);
		const copyTo = path.join(
			process.cwd(),
			"build",
			"compute",
			"nodejs",
			rootId,
			buildId,
		);

		console.time(copyTo);

		if (isDryRun()) {
			try {
				await NodejsComponent.handleSource(copyFrom, tempDir);

				if (protocols !== undefined) {
					await NodejsComponent.handleProtocols(
						protocols,
						protocolLanguage,
						tempDir,
						srcRoot,
					);
				}

				console.debug({
					NodeJsComponent: { build: { source: copyFrom, tempDir } },
				});

				// execSync(`cp -r ${tempDir}/node_modules ${copyTo}`, {
				//   stdio: "ignore",
				// });
				execSync(`rm -rf ${tempDir}/node_modules`, { stdio: "ignore" });

				if (executor === "DOCKER") {
					await NodejsComponent.buildWithDocker(
						environment,
						tempDir,
						copyTo,
						nodeVersion,
						envs,
						artifact,
					);
				} else if (executor === "SHELL") {
					await NodejsComponent.buildWithShell(tempDir, copyTo, envs, artifact);
				} else {
					throw new Error("Invalid executor specified.");
				}

				// Verify the build
				console.debug({
					NodeJsComponent: {
						step: "CONFIRM",
						copyTo,
						out: execSync(`ls ${copyTo}`, { encoding: "ascii" }),
					},
				});
			} catch (error) {
				console.error({
					NodeJsComponent: {
						error: {
							error,
							string: error?.toString(),
							splat: {
								...((error as unknown as {}) ?? {}),
							},
							stack: {
								stack: (error as unknown as { stack: unknown })?.stack,
							},
						},
					},
				});

				throw error;
			} finally {
				if (existsSync(tempDir)) {
					console.debug({
						NodeJsComponent: {
							step: "CLEANUP",
							tempDir,
							exists: existsSync(tempDir),
							output: execSync(
								`rm -rf ${path.join(process.cwd(), "build", "temp", "build", "compute", "nodejs", "/")};`,
								{ encoding: "ascii" },
							),
						},
					});
				}
			}
		}

		console.timeEnd(copyTo);

		return { root: copyTo, buildId, nodeVersion };
	}

	public static async getSourceIdentifier(copyFrom: CopyFrom): Promise<string> {
		if (copyFrom?.git) {
			return await NodejsComponent.getGitCommitSHA(
				copyFrom.git.url,
				copyFrom.git.branch,
			);
		}
		if (copyFrom?.local) {
			return await NodejsComponent.getLocalPathHash(copyFrom.local.path);
		}
		throw new Error("Invalid copyFrom source.");
	}

	private static async getGitCommitSHA(
		url: string,
		branch: string | undefined,
	): Promise<string> {
		const branchOption = branch ? `--branch ${branch}` : "";
		const tempDir = execSync(`mktemp -d`).toString().trim();
		execSync(`git clone ${branchOption} ${url} ${tempDir}`, {
			stdio: "ignore",
		});
		const commitSHA = execSync(`git -C ${tempDir} rev-parse HEAD`)
			.toString()
			.trim();
		execSync(`rm -rf ${tempDir}`);
		return commitSHA;
	}

	private static async getLocalPathHash(localPath: string): Promise<string> {
		const result = await hashElement(localPath, {
			encoding: "base64url",
			folders: {
				exclude: ["node_modules", ".*", "test_coverage", "build"],
			},
			files: {
				include: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.json"],
			},
		});
		let hash = result.hash;
		while ([".", "-"].includes(hash[0])) {
			hash = `_${hash}`;
		}
		return hash;
	}

	public static async handleSource(
		copyFrom: ComputeComponentBuildProps["copyFrom"],
		tempDir: string,
	): Promise<void> {
		if (copyFrom?.git) {
			await NodejsComponent.cloneGitRepo(
				copyFrom.git.url,
				copyFrom.git.branch,
				tempDir,
			);
		} else if (copyFrom?.local) {
			NodejsComponent.copyLocalDir(copyFrom.local.path, tempDir);
		} else {
			throw new Error("No valid source provided in 'copyFrom'.");
		}
	}

	static async copyProtocolInto(
		protocolName: string,
		protocolBuildResult: ProtocolComponentBuildResult,
		protocolLanguage: string,
		tempDir: string,
		srcDir: string,
	): Promise<void> {
		const buildResultDirectory = protocolBuildResult.protocolDir;
		const destinationDir = `${tempDir}/${srcDir}/_protocols/${protocolName}/`;

		execSync(`mkdir -p ${destinationDir}`, { stdio: "inherit" });

		execSync(
			`cp -r ${buildResultDirectory}/${protocolLanguage} ${destinationDir}`,
			{ stdio: "inherit" },
		);
		console.debug({
			ProtobufComponentNodejs: {
				message: "Copied protocol into compute root",
				tempDir,
				srcDir,
				protocolName,
				protocolLanguage,
				protocolBuildResult,
				buildResultDirectory,
			},
		});
	}

	private static cloneGitRepo(
		url: string,
		branch: string | undefined,
		tempDir: string,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				console.debug(
					`Cloning Git repository from ${url} (branch: ${branch ?? "main"}) to ${tempDir}`,
				);
				execSync(`git clone --branch ${branch ?? "main"} ${url} ${tempDir}`, {
					stdio: "inherit",
				});
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	}

	public static async handleProtocols<
		Protocols extends ProtocolMap<
			string,
			ProtocolComponentBuildResult
		> = ProtocolMap<string, ProtocolComponentBuildResult>,
	>(
		protocols: Protocols,
		protocolLanguage: string,
		tempDir: string,
		srcRoot: string,
	): Promise<void> {
		for (const [protocolName, protocolBuildResult] of Object.entries(
			protocols,
		)) {
			NodejsComponent.copyProtocolInto(
				protocolName,
				protocolBuildResult,
				protocolLanguage,
				tempDir,
				srcRoot,
			);
		}
	}

	private static copyLocalDir(sourcePath: string, destDir: string): void {
		console.debug(`Copying local directory from ${sourcePath} to ${destDir}`);
		cpSync(sourcePath, destDir, { recursive: true });
	}

	private static async buildWithDocker(
		stack: Context["environment"],
		tempDir: string,
		copyTo: string,
		nodeVersion: string,
		envs: { [k: string]: string },
		artifact: string,
	): Promise<void> {
		const { isProd } = stack;
		const dockerfilePath = path.join(tempDir, "Dockerfile");
		const dockerfileContent = `
      FROM node:${nodeVersion}
      RUN apt-get update && apt-get install -y python3
      WORKDIR /app
      COPY package*.json ./
      CMD ["mkdir", "assets"]
      COPY . .
      RUN npm install

      ENV NODE_ENV=${isProd ? "production" : "development"}      
      RUN npm run build
      RUN apt-get install -y zip
    `;
		mkdirSync(path.dirname(dockerfilePath), { recursive: true });
		writeFileSync(dockerfilePath, dockerfileContent);

		console.debug({
			NodejsComponent: {
				message: "Building Docker image",
				dockerfilePath,
			},
		});

		execSync(`docker build -t nodejs-build -f ${dockerfilePath} ${tempDir}`, {
			stdio: "inherit",
		});

		const envVars = Object.entries(envs)
			.map(([key, value]) => `-e ${key}=${value}`)
			.join(" ");

		console.debug({
			NodejsComponent: {
				message: "Copying build artifacts from Docker container",
				copyTo,
			},
		});

		const envVarsString = envVars.length > 0 ? `${envVars}` : ``;
		execSync(
			`docker run --rm ${envVarsString} -v ${copyTo}:/output nodejs-build cp -r /app${artifact !== "" ? `/${artifact}` : ""} /app/package.json /output`,
			{ stdio: "inherit" },
		);
		execSync(`docker rmi nodejs-build:latest`, { stdio: "ignore" });
	}

	private static async buildWithShell(
		tempDir: string,
		copyTo: string,
		environment: { [k: string]: string },
		artifact: string,
	): Promise<void> {
		const spawnArgs: ExecSyncOptions = { encoding: "ascii" };

		console.debug({
			NodeJsComponent: { build: { directory: tempDir, environment } },
		});
		const { command } = NodejsComponent.PACKAGE_MANAGER;
		console.debug({
			NodeJsComponent: {
				step: "VERIFY ROOT",
				out: execSync(`cd ${tempDir}; pwd; ls;`, spawnArgs),
			},
		});

		console.debug({
			NodeJsComponent: {
				step: "INSTALL DEPENDENCIES",
				out: execSync(`cd ${tempDir}; ${command} install;`, spawnArgs),
			},
		});

		console.debug({
			NodeJsComponent: {
				step: "RUN BUILD",
				out: execSync(`cd ${tempDir}; ${command} run build;`, spawnArgs),
			},
		});

		// Make sure folder exists
		mkdirSync(copyTo, { recursive: true });

		console.debug({
			NodeJsComponent: {
				step: "COPY PACKAGE JSON",
				out: cpSync(`${tempDir}/package.json`, copyTo, { recursive: true }),
			},
		});

		console.debug({
			NodeJsComponent: {
				step: "COPY BUILD ARTIFACTS",
				out: cpSync(`${tempDir}/${artifact}`, copyTo, { recursive: true }),
			},
		});
	}
}
