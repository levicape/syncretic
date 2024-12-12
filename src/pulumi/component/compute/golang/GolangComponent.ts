import { type ExecSyncOptions, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
type GolangVersion = "1.21" | "1.22" | "1.23" | "1.23.1";
type GolangMainFilePath = `cmd/${string}/main.go` | `${string}.go`;

export type GolangBuildArtifact =
	`${"darwin" | `linux` | string}_${`arm64` | string}/${string}`;
export type GolangBuildResult = {
	artifacts: GolangBuildArtifact[];
};

export type GolangComponentBuildProps = {
	goVersion: GolangVersion;
	main: GolangMainFilePath;
} & ComputeComponentBuildProps;

export type GolangComponentBuildResult = {
	goVersion: GolangVersion;
	build: GolangBuildResult;
	rootId: string;
	main: GolangMainFilePath;
} & ComputeComponentBuildResult;

export class GolangComponent extends ComputeComponent {
	static readonly URN: `compute:${string}::golang` = "compute:*::golang";

	static async build(
		_: Context,
		props: GolangComponentBuildProps,
	): Promise<GolangComponentBuildResult> {
		const {
			srcRoot,
			copyFrom,
			executor,
			envs,
			goVersion = "1.23",
			artifact = "go.out/main",
			command = "go build",
			main,
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
			"golang--repo-final",
		);
		let finalRepoDir = finalDir;
		if (copyFrom.git !== undefined) {
			const tempDir = path.join(
				tmpdir(),
				rootId,
				timestamp,
				"temp",
				"golang--repo-temp",
			);

			await GolangComponent.cloneGitRepo(
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
			buildId = await GolangComponent.getSourceIdentifier(copyFrom);
		}

		const tempDir = finalRepoDir;
		const copyTo = path.join(
			process.cwd(),
			"build",
			"compute",
			"golang",
			rootId,
			buildId,
		);

		console.time(copyTo);

		let build: GolangBuildResult;
		try {
			await GolangComponent.handleSource(copyFrom, tempDir);

			if (protocols !== undefined) {
				await GolangComponent.handleProtocols(
					protocols,
					"gogo",
					tempDir,
					srcRoot,
				);
			}

			console.debug({
				GolangComponent: { build: { source: copyFrom, tempDir } },
			});

			if (executor === "DOCKER") {
				build = await GolangComponent.buildWithDocker(
					tempDir,
					copyTo,
					goVersion,
					envs ?? {},
					command,
					artifact,
					main,
				);
			} else if (executor === "SHELL") {
				build = await GolangComponent.buildWithShell(
					tempDir,
					copyTo,
					envs ?? {},
					command,
					artifact,
					main,
				);
			} else {
				throw new Error("Invalid executor specified.");
			}

			// Verify the build
			console.debug({
				GolangComponent: {
					step: "CONFIRM",
					copyTo,
					out: execSync(`ls -R ${copyTo}`, { encoding: "ascii" }),
				},
			});
		} catch (error) {
			console.error({
				GolangComponent: {
					error: {
						error,
						string: error?.toString(),
						json: JSON.stringify(error),
					},
				},
			});
			throw error;
		} finally {
			if (existsSync(tempDir)) {
				setTimeout(() => {
					rmSync(tempDir, { recursive: true, force: true });
				}, 2500);
			}
		}

		console.timeEnd(copyTo);

		return { root: copyTo, buildId, goVersion, build, rootId, main };
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
				await GolangComponent.copyProtocolInto(
					protocolName,
					protocolBuildResult,
					protocolLanguage,
					tempDir,
					srcRoot,
				);
			}
		}
	}

	public static async getSourceIdentifier(copyFrom: CopyFrom): Promise<string> {
		if (copyFrom?.git) {
			return GolangComponent.getGitCommitSHA(
				copyFrom.git.url,
				copyFrom.git.branch,
			);
		}
		if (copyFrom?.local) {
			return GolangComponent.getLocalPathHash(copyFrom.local.path);
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
				exclude: ["go.out"],
			},
			files: {
				include: ["*.go", "*.sum", "*.mod", "*.yml"],
			},
		});
		return result.hash;
	}

	public static async handleSource(
		copyFrom: ComputeComponentBuildProps["copyFrom"],
		tempDir: string,
	): Promise<void> {
		if (copyFrom?.git) {
			await GolangComponent.cloneGitRepo(
				copyFrom.git.url,
				copyFrom.git.branch,
				tempDir,
			);
		} else if (copyFrom?.local) {
			GolangComponent.copyLocalDir(copyFrom.local.path, tempDir);
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
			GolangComponent: {
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

	private static copyLocalDir(sourcePath: string, destDir: string): void {
		console.debug(`Copying local directory from ${sourcePath} to ${destDir}`);
		cpSync(sourcePath, destDir, { recursive: true });
	}

	private static async buildWithDocker(
		tempDir: string,
		copyTo: string,
		goVersion: string,
		environment: { [k: string]: string },
		command: string,
		artifact: string,
		main: string,
	): Promise<GolangBuildResult> {
		const dockerfilePath = path.join(tempDir, "Dockerfile");
		let outputs: GolangBuildArtifact[] = [];
		// TODO: Props for specifying OS and ARCH

		// TODO artifact : { path: string, name: string }
		const goxxDockerfileContent = `
      FROM --platform=$BUILDPLATFORM crazymax/goxx:${goVersion} AS goxx
      FROM --platform=$BUILDPLATFORM crazymax/osxcross:13.1 AS osxcross
      
      FROM goxx AS base
      ENV GO111MODULE=auto
      ENV CGO_ENABLED=1
      WORKDIR /app
      
      FROM base as build
      ARG TARGETPLATFORM
      RUN --mount=type=cache,sharing=private,target=/var/cache/apt \
        --mount=type=cache,sharing=private,target=/var/lib/apt/lists \
        goxx-apt-get install -y binutils gcc g++ pkg-config

      RUN --mount=type=bind,source=.,target=/app \
      --mount=from=osxcross,target=/osxcross,src=/osxcross,rw \
      --mount=type=cache,target=/root/.cache \
      goxx-go env && goxx-${command} -v -o /appgoxx/${artifact} ${main}

      FROM scratch AS artifact
      COPY --from=build /appgoxx /        
    `;

		mkdirSync(path.dirname(dockerfilePath), { recursive: true });
		writeFileSync(dockerfilePath, goxxDockerfileContent);

		console.debug({
			GolangComponent: {
				message: "Building Docker image",
				dockerfilePath,
			},
		});
		execSync(
			[
				`docker buildx build`,
				`-f ${dockerfilePath}`,
				`--platform linux/arm64,darwin/arm64`,
				`--output "${copyTo}"`,
				`--target artifact`,
				`.`,
			].join(" "),
			{
				stdio: "inherit",
				cwd: tempDir,
			},
		);

		outputs = [`linux_arm64/${artifact}`, `darwin_arm64/${artifact}`];

		console.debug({
			GolangComponent: {
				message: "Golang artifacts",
				outputs,
				copyTo,
			},
		});

		return { artifacts: outputs };
	}

	private static async buildWithShell(
		tempDir: string,
		copyTo: string,
		environment: { [k: string]: string },
		command: string,
		artifact: string,
		main: string,
	): Promise<GolangBuildResult> {
		const spawnArgs: ExecSyncOptions = { encoding: "ascii", env: environment };

		console.debug({
			GolangComponent: { build: { directory: tempDir, environment } },
		});

		console.debug({
			GolangComponent: {
				step: "VERIFY ROOT",
				out: execSync(`cd ${tempDir}; pwd; ls;`, spawnArgs),
			},
		});

		let outputs: GolangBuildResult["artifacts"] = [];
		const goarchGoosPairs: [string, string][] = [
			["amd64", "linux"],
			["arm64", "linux"],
			["wasm", "js"],
			["amd64", "darwin"],
			["arm64", "darwin"],
		] as const;

		for (const [goarch, goos] of goarchGoosPairs) {
			const output = `${goos}_${goarch}/${artifact}` as const;
			outputs = [...outputs, output];
			console.debug({
				GolangComponent: {
					step: "BUILD",
					out: execSync(
						`cd ${tempDir}; GOARCH=${goarch} GOOS=${goos} ${command} -o ${output} ${main};`,
						spawnArgs,
					),
				},
			});
		}
		console.debug({
			GolangComponent: {
				step: "BUILD",
				out: execSync(
					`cd ${tempDir}; ${command} -o ${artifact} ${main};`,
					spawnArgs,
				),
			},
		});

		// Make sure folder exists
		mkdirSync(copyTo, { recursive: true });

		console.debug({
			GolangComponent: {
				step: "COPY BUILD ARTIFACTS",
				out: cpSync(`${tempDir}/${artifact}`, copyTo, { recursive: true }),
			},
		});

		return { artifacts: outputs };
	}
}

/*
 GO111MODULE="auto"
 GOARCH="arm64"
 GOBIN=""
 GOCACHE="/root/.cache/go-build"
 GOENV="/root/.config/go/env"
 GOEXE=""
 GOEXPERIMENT=""
 GOFLAGS=""
 GOHOSTARCH="arm64"
 GOHOSTOS="linux"
 GOINSECURE=""
 GOMODCACHE="/go/pkg/mod"
 GONOPROXY=""
 GONOSUMDB=""
 GOOS="darwin"
 GOPATH="/go"
 GOPRIVATE=""
 GOPROXY="https://proxy.golang.org,direct"
 GOROOT="/usr/local/go"
 GOSUMDB="sum.golang.org"
 GOTMPDIR=""
 GOTOOLDIR="/usr/local/go/pkg/tool/linux_arm64"
 GOVCS=""
 GOVERSION="go1.17.13"
 GCCGO="gccgo"
 AR="ar"
 CC="o64-clang"
 CXX="o64-clang++"
 CGO_ENABLED="1"
 GOMOD="/app/go.mod"
 CGO_CFLAGS="-g -O2"
 CGO_CPPFLAGS=""
 CGO_CXXFLAGS="-g -O2"
 CGO_FFLAGS="-g -O2"
 CGO_LDFLAGS="-g -O2"
 PKG_CONFIG="pkg-config"
 GOGCCFLAGS="-fPIC -arch arm64 -pthread -fno-caret-diagnostics -Qunused-arguments -fmessage-length=0 -fdebug-prefix-map=/tmp/go-build2887210126=/tmp/go-build -gno-record-gcc-switches -fno-common"
*/

/*
    #12 0.310 GO111MODULE="auto"
    #12 0.310 GOARCH="arm64"
    #12 0.310 GOBIN=""
    #12 0.310 GOCACHE="/root/.cache/go-build"
    #12 0.310 GOENV="/root/.config/go/env"
    #12 0.310 GOEXE=""
    #12 0.310 GOEXPERIMENT=""
    #12 0.310 GOFLAGS=""
    #12 0.310 GOHOSTARCH="arm64"
    #12 0.310 GOHOSTOS="linux"
    #12 0.310 GOINSECURE=""
    #12 0.310 GOMODCACHE="/go/pkg/mod"
    #12 0.310 GONOPROXY=""
    #12 0.310 GONOSUMDB=""
    #12 0.310 GOOS="linux"
    #12 0.310 GOPATH="/go"
    #12 0.310 GOPRIVATE=""
    #12 0.310 GOPROXY="https://proxy.golang.org,direct"
    #12 0.310 GOROOT="/usr/local/go"
    #12 0.310 GOSUMDB="sum.golang.org"
    #12 0.310 GOTMPDIR=""
    #12 0.310 GOTOOLDIR="/usr/local/go/pkg/tool/linux_arm64"
    #12 0.310 GOVCS=""
    #12 0.310 GOVERSION="go1.17.13"
    #12 0.310 GCCGO="gccgo"
    #12 0.310 AR="aarch64-linux-gnu-ar"
    #12 0.310 CC="aarch64-linux-gnu-gcc"
    #12 0.310 CXX="aarch64-linux-gnu-g++"
    #12 0.310 CGO_ENABLED="1"
    #12 0.310 GOMOD="/app/go.mod"
    #12 0.310 CGO_CFLAGS="-g -O2"
    #12 0.310 CGO_CPPFLAGS=""
    #12 0.310 CGO_CXXFLAGS="-g -O2"
    #12 0.310 CGO_FFLAGS="-g -O2"
    #12 0.310 CGO_LDFLAGS="-g -O2"
    #12 0.310 PKG_CONFIG="aarch64-linux-gnu-pkg-config"
    #12 0.310 GOGCCFLAGS="-fPIC -pthread -fmessage-length=0 -fdebug-prefix-map=/tmp/go-build3608790424=/tmp/go-build -gno-record-gcc-switches"
    #12 0.326 go: downloading github.com/google/uuid v1.6.0
*/
