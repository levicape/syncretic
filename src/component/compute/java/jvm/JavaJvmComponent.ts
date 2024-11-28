import { type ExecSyncOptions, execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { hashElement } from "folder-hash";
import type { Context } from "../../../../context/Context.js";
import {
	ComputeComponent,
	type ComputeComponentBuildProps,
	type ComputeComponentBuildResult,
} from "../../ComputeComponent.js";
import type {
	ProtocolComponentBuildResult,
	ProtocolMap,
} from "../../protocol/ProtocolComponent.js";
import type { JavaJvmComponentAwsProps } from "./JavaJvmComponentAws.js";

type CopyFrom = ComputeComponentBuildProps["copyFrom"];

export type JvmVersion = "21";
export type JvmGradleVersion = "8.10";

export type JvmAlpineFeature = "-alpine" | "";
export type JvmGraalFeature = "-graal" | "";

export type JvmImage =
	| `amazoncorretto:${JvmVersion}-al2023`
	| `container-registry.oracle.com/graalvm/jdk:${JvmVersion}`;
export type JvmGradleImage =
	`gradle:${JvmGradleVersion}-jdk${JvmVersion}${JvmAlpineFeature | JvmGraalFeature}`;
export type JvmPackageManagerImage = JvmGradleImage;
export type JvmArchitecture = "aarch64";

export type JavaJvmComponentBuildProps = {
	handler: JavaJvmComponentAwsProps["handler"];
	version: {
		jvm: JvmVersion;
		image: JvmImage;
		arch: JvmArchitecture;
	};
	jdk: {
		image?: JvmPackageManagerImage;
		curl?: {
			base: `public.ecr.aws/amazonlinux/amazonlinux:2023`;
			url: `https://download.oracle.com/graalvm/${JvmVersion}/latest/graalvm-jdk-${JvmVersion}_linux-${JvmArchitecture}_bin.tar.gz`;
		};
	};
} & Omit<ComputeComponentBuildProps, "handler">;

export type JavaJvmComponentBuildResult = {
	version: JavaJvmComponentBuildProps["version"];
	jarFile: string;
} & ComputeComponentBuildResult;

export class JavaJvmComponent extends ComputeComponent {
	static readonly URN: `compute:${string}::java` = "compute:*::java";

	static async build(
		_: Context,
		props: JavaJvmComponentBuildProps,
	): Promise<JavaJvmComponentBuildResult> {
		const {
			srcRoot,
			copyFrom,
			executor,
			envs: environment,
			jdk,
			version,
			command = "gradle shadowDistZip",
			artifact,
			protocols,
		} = props;

		const rootId = (copyFrom.git?.url ?? copyFrom.local?.path ?? "void")
			.replaceAll("/", "_")
			.replaceAll(":", "-")
			.replaceAll("..", "");

		const timestamp = Date.now().toString();
		let buildId: string;
		const finalDir = path.join(
			tmpdir(),
			rootId,
			timestamp,
			"javajvm__repo-final",
		);
		let finalRepoDir = finalDir;
		if (copyFrom.git !== undefined) {
			const tempDir = path.join(
				tmpdir(),
				rootId,
				timestamp,
				"temp",
				"javajvm__repo-temp",
			);

			await JavaJvmComponent.cloneGitRepo(
				copyFrom.git.url,
				copyFrom.git.branch,
				tempDir,
			);
			const gitSha = execSync(`cd ${tempDir} && git rev-parse HEAD`)
				.toString()
				.trim();
			buildId = gitSha;

			finalRepoDir = path.join(finalDir, buildId);
			execSync(`mv ${tempDir} ${finalRepoDir}`);
		} else {
			buildId = await JavaJvmComponent.getSourceIdentifier(copyFrom);
		}

		const directory = finalRepoDir;
		const copyTo = path.join(
			process.cwd(),
			"build",
			"compute",
			"javajvm",
			rootId,
			buildId,
		);

		console.time(copyTo);
		console.debug({
			JavaComponent: {
				build: {
					buildId,
					directory,
					copyTo,
				},
				args: {
					copyFrom,
				},
			},
		});

		if (isDryRun()) {
			try {
				await JavaJvmComponent.handleSource(copyFrom, directory);

				if (protocols !== undefined) {
					await JavaJvmComponent.handleProtocols(
						protocols,
						"gogo",
						directory,
						srcRoot,
					);
				}

				if (executor === "DOCKER") {
					await JavaJvmComponent.buildWithDocker(
						directory,
						copyTo,
						environment ?? {},
						jdk,
						version,
						command,
						artifact,
					);
				} else if (executor === "SHELL") {
					await JavaJvmComponent.buildWithShell(
						directory,
						copyTo,
						environment ?? {},
						copyFrom,
						command,
					);
				} else {
					throw new Error("Invalid executor specified.");
				}

				console.debug({
					JavaComponent: {
						buildId,
						step: "CONFIRM",
						copyTo,
						out: execSync(`pwd; cd ${copyTo}; pwd; ls;`, { encoding: "ascii" }),
					},
				});
			} catch (error) {
				console.error({
					JavaComponent: {
						buildId,
						error: {
							error,
							string: error?.toString(),
							json: JSON.stringify(error),
						},
					},
				});
				throw error;
			}
		}

		console.timeEnd(copyTo);

		const jarFiles = execSync(`ls ${copyTo}/libs`, { encoding: "ascii" })
			.toString()
			.trim()
			.split("\n");

		const jarFile =
			jarFiles.find((file) => file.includes("all-optimized.jar")) ??
			jarFiles[0];

		return {
			root: copyTo,
			buildId,
			version,
			jarFile,
		};
	}

	private static async getSourceIdentifier(
		copyFrom: CopyFrom,
	): Promise<string> {
		if (copyFrom?.git) {
			return JavaJvmComponent.getGitCommitSHA(
				copyFrom.git.url,
				copyFrom.git.branch,
			);
		}
		if (copyFrom?.local) {
			return JavaJvmComponent.getLocalPathHash(copyFrom.local.path);
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
				exclude: [".gradle", ".*", "build"],
			},
			files: {
				include: ["*.java", "*.gradle*", "*.properties", "*.yml"],
			},
		});
		return result.hash;
	}

	static async handleProtocols(
		protocols: ProtocolMap<string, ProtocolComponentBuildResult>,
		protocolLanguage: string,
		tempDir: string,
		srcRoot: string,
	) {
		if (protocols !== undefined) {
			for (const [protocolName, protocolBuildResult] of Object.entries(
				protocols,
			)) {
				await JavaJvmComponent.copyProtocolInto(
					protocolName,
					protocolBuildResult,
					protocolLanguage,
					tempDir,
					srcRoot,
				);
			}
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
			JavaJvmComponent: {
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

	private static async handleSource(
		copyFrom: ComputeComponentBuildProps["copyFrom"],
		tempDir: string,
	): Promise<void> {
		if (copyFrom?.git) {
			await JavaJvmComponent.cloneGitRepo(
				copyFrom.git.url,
				copyFrom.git.branch,
				tempDir,
			);
		} else if (copyFrom?.local) {
			JavaJvmComponent.copyLocalDir(copyFrom.local.path, tempDir);
		} else {
			throw new Error("No valid source provided in 'copyFrom'.");
		}
	}

	private static cloneGitRepo(
		url: string,
		branch: string | undefined,
		tempDir: string,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				console.debug({
					JavaJvmComponent: {
						message: "Cloning Git repository",
						url,
						branch,
						tempDir,
					},
				});
				execSync(`git clone --branch ${branch ?? "main"} ${url} ${tempDir}`, {
					stdio: "inherit",
				});
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	}

	private static copyLocalDir(sourcePath: string, destDir: string): void {
		console.debug(`Copying local directory from ${sourcePath} to ${destDir}`);
		cpSync(sourcePath, destDir, { recursive: true });
	}

	public static async buildWithShell(
		tempDir: string,
		copyTo: string,
		environment: { [k: string]: string },
		copyFrom: ComputeComponentBuildProps["copyFrom"],
		command: string,
	): Promise<void> {
		const spawnArgs: ExecSyncOptions = { encoding: "ascii", env: environment };

		const localPath = copyFrom?.local?.path;
		if (!localPath) {
			throw new Error(
				"Invalid 'copyFrom' for SHELL executor. Local path is required.",
			);
		}

		console.debug({
			JavaComponent: { build: { directory: tempDir, environment } },
		});

		console.debug({
			JavaComponent: {
				step: "VERIFY ROOT",
				out: execSync(`cd ${tempDir}; pwd; ls;`, spawnArgs),
			},
		});

		console.debug({
			JavaComponent: {
				step: "INSTALL DEPENDENCIES",
				out: execSync(`cd ${tempDir}; gradlew dependencies;`, spawnArgs),
			},
		});

		console.debug({
			JavaComponent: {
				step: "RUN BUILD",
				out: execSync(`cd ${tempDir}; ${command};`, spawnArgs),
			},
		});

		// Make sure folder exists
		mkdirSync(copyTo, { recursive: true });

		console.debug({
			JavaComponent: {
				step: "COPY BUILD ARTIFACTS",
				out: cpSync(`${tempDir}/${localPath}`, copyTo, { recursive: true }),
			},
		});
	}

	public static async buildWithDocker(
		tempDir: string,
		copyTo: string,
		environment: { [k: string]: string },
		jdk: JavaJvmComponentBuildProps["jdk"],
		version: JavaJvmComponentBuildProps["version"],
		command: string,
		artifact: string,
	): Promise<void> {
		const dockerfilePath = path.join(tempDir, "Dockerfile");
		const dockerfileContent = jdk.image
			? `
        FROM ${jdk.image}
        WORKDIR /app
        COPY ./gradle ./*.gradle* ./*.properties *.yml ./
        RUN gradle dependencies --no-daemon
        COPY . .
        RUN ${command} --no-daemon
      `
			: `
FROM ${jdk.curl?.base}
WORKDIR /app
RUN curl -4 -L ${jdk.curl?.url} | tar -xvz
RUN mv graalvm-jdk-${version.jvm}* /usr/lib/graalvm
ENV JAVA_HOME /usr/lib/graalvm
COPY . .
RUN ./${command}`;

		mkdirSync(path.dirname(dockerfilePath), { recursive: true });
		writeFileSync(dockerfilePath, dockerfileContent);

		console.debug({
			JavaJvmComponent: {
				message: "Building Docker image",
				dockerfilePath,
			},
		});
		execSync(`docker build -t java-build -f ${dockerfilePath} ${tempDir}`, {
			stdio: "inherit",
		});

		// Environment variables setup
		const envVars = Object.entries(environment)
			.map(([key, value]) => `-e ${key}=${value}`)
			.join(" ");

		console.debug({
			JavaJvmComponent: {
				message: "Copying artifacts",
				copyTo,
			},
		});
		const envflag = envVars.length > 0 ? `${envVars}` : ``;
		execSync(
			`docker run --rm ${envflag} -v ${copyTo}:/output java-build cp -r /app/${artifact} /output`,
			{ stdio: "inherit" },
		);
	}
}
