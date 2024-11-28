import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import { hashElement } from "folder-hash";
import type { Context } from "../../../context/Context.js";
import type {
	ProtocolComponentBuildProps,
	ProtocolComponentBuildResult,
} from "./ProtocolComponent.js";

const EXPORT_FEATURES = [
	"go",
	"gogo",
	"ruby",
	"csharp",
	"java",
	"python",
	"objc",
	"php",
	"node",
	...["typescript_buffer", "typescript"],
	"web",
	"cpp",
	"descriptor_set",
	"scala",
] as const;
export type ProtobufExport = (typeof EXPORT_FEATURES)[number];
export interface ProtobufComponentBuildProps
	extends ProtocolComponentBuildProps {
	language: ProtobufExport;
	go?:
		| {
				modulePrefix: string;
				relativeSource?: never;
		  }
		| {
				modulePrefix?: never;
				relativeSource: boolean;
		  };
}

export type ProtobufBuildLanguagesProps = Omit<
	ProtobufComponentBuildProps,
	"language" | "encoding"
>;

export interface ProtobufComponentBuildResult
	extends ProtocolComponentBuildResult {}

export class ProtobufComponent {
	static readonly URN: `compute:${string}::protobuf` = "compute:*::protobuf";

	static readonly GO_LANGUAGES: ProtobufExport[] = ["go", "gogo"] as const;
	static readonly JS_LANGUAGES: ProtobufExport[] = ["node", "web"] as const;
	static readonly TS_LANGUAGES: ProtobufExport[] = [
		"typescript",
		"typescript_buffer",
	] as const;
	static readonly ALIASES: Partial<Record<ProtobufExport, ProtobufExport>> = {
		typescript_buffer: "typescript",
	};

	static async forLanguages(
		context: Context,
		languages: ProtobufExport[],
		props: ProtobufBuildLanguagesProps,
	): Promise<Record<string, ProtobufComponentBuildResult | undefined>> {
		const result = await (async () => {
			const resolved: Array<
				ProtobufComponentBuildResult & { language: ProtobufExport }
			> = await Promise.all(
				languages.flatMap((language) => {
					return ProtobufComponent.build(context, {
						...props,
						language,
					}).then((build) => {
						return { ...build, language };
					});
				}),
			);

			return Object.fromEntries(
				resolved.map((result) => [result.language, result]),
			);
		})();

		return result;
	}
	static async build(
		_: Context,
		props: ProtobufComponentBuildProps,
	): Promise<ProtobufComponentBuildResult> {
		const { copyFrom, language, go } = {
			go: { relativeSource: false, ...props.go },
			...props,
		};

		const rootId = (copyFrom.git?.url ?? copyFrom.local?.path ?? "void")
			.replaceAll("/", "_")
			.replaceAll(":", "-")
			.replaceAll("..", "");
		const buildId = await ProtobufComponent.getSourceIdentifier(copyFrom);
		const tempDir = path.join(
			process.cwd(),
			"build",
			"temp",
			"build",
			"protocol",
			"protobuf",
			rootId,
			buildId,
			"source",
			language,
		);
		const outDir = path.join(
			process.cwd(),
			"build",
			"temp",
			"build",
			"protocol",
			"protobuf",
			rootId,
			buildId,
			"output",
			language,
		);

		const protocolDir = path.join(
			process.cwd(),
			"build",
			"protocol",
			"protobuf",
			rootId,
			buildId,
		);

		const copyTo = path.join(
			process.cwd(),
			"build",
			"protocol",
			"protobuf",
			rootId,
			buildId,
			language,
		);

		{
			const { modulePrefix, relativeSource } = go;

			if (
				ProtobufComponent.GO_LANGUAGES.includes(language) &&
				modulePrefix === undefined
			) {
				if (relativeSource === undefined) {
					throw new Error(
						`ProtobufComponent: Please specify either modulePrefix or relativeSource ${buildId}`,
					);
				}
			}
		}

		console.time(copyTo);

		if (!existsSync(tempDir)) {
			mkdirSync(tempDir, { recursive: true });
		}

		await ProtobufComponent.handleSource(copyFrom, tempDir);

		const jsout = ProtobufComponent.JS_LANGUAGES.includes(language)
			? "--js-out import_style=commonjs"
			: "";
		const grpcwebout = ProtobufComponent.JS_LANGUAGES.includes(language)
			? `--grpc-web-out import_style=typescript,mode=grpcweb`
			: "";
		const withts = language === "node" ? "--with-typescript" : "";
		const tsopt = ProtobufComponent.TS_LANGUAGES.includes(language)
			? `--ts_opt ${[
					"esModuleInterop=true",
					"forceLong=number",
					"noDefaultsForOptionals=true",
					"oneof=unions-value",
					...(language === "typescript_buffer" ? ["env=node"] : []),
				].join(",")}`
			: "";
		const gomodprefix = ProtobufComponent.GO_LANGUAGES.includes(language)
			? go.modulePrefix !== undefined
				? `--go-module-prefix ${go.modulePrefix}`
				: go.relativeSource === true
					? `--go-source-relative`
					: ""
			: "";

		const flags: string[] = [
			tsopt,
			withts,
			jsout,
			grpcwebout,
			gomodprefix,
		].filter((f) => f !== "");

		const aliasedLanguage = ProtobufComponent.ALIASES[language] ?? language;

		const command = [
			`docker run`,
			`--name ProtobufComponent_protoc-build-${language}`,
			`--rm`,
			`-v ${tempDir}:/defs`,
			`-v ${outDir}:/protocoutput`,
			`namely/protoc-all`,
			`-d .`,
			`-o /protocoutput`,
			`-l ${aliasedLanguage}`,
			...flags,
		].join(" ");

		console.debug({
			ProtobufComponent: {
				message: "Running protoc-all",
				command,
				flags,
				tempDir,
				props: {
					language,
					copyFrom,
					args: {
						jsout,
						grpcwebout,
						tsopt,
						withts,
					},
				},
				output: execSync(command, { stdio: "inherit", encoding: "ascii" }),
			},
		});

		// Make sure folder exists
		mkdirSync(copyTo, { recursive: true });

		console.debug({
			ProtobufComponent: {
				step: "COPY BUILD ARTIFACTS",
				out: cpSync(`${outDir}`, copyTo, { recursive: true }),
			},
		});

		console.timeEnd(copyTo);

		return { root: copyTo, buildId, protocolDir };
	}

	private static async getSourceIdentifier(
		copyFrom: ProtobufComponentBuildProps["copyFrom"],
	): Promise<string> {
		if (copyFrom?.git) {
			return await ProtobufComponent.getGitCommitSHA(
				copyFrom.git.url,
				copyFrom.git.branch,
			);
		}
		if (copyFrom?.local) {
			return await ProtobufComponent.getLocalPathHash(copyFrom.local.path);
		}
		throw new Error("No valid source provided for ProtobufComponent.");
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
				exclude: ["node_modules", ".*", "test_coverage"],
			},
			files: {
				include: ["*.proto"],
			},
		});
		return result.hash.substring(0, 16);
	}

	public static async handleSource(
		copyFrom: ProtobufComponentBuildProps["copyFrom"],
		tempDir: string,
	): Promise<void> {
		if (copyFrom?.git) {
			await ProtobufComponent.cloneGitRepo(
				copyFrom.git.url,
				copyFrom.git.branch,
				tempDir,
			);
		} else if (copyFrom?.local) {
			ProtobufComponent.copyLocalDir(copyFrom.local.path, tempDir);
		} else {
			throw new Error("No valid source provided for ProtobufComponent.");
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
					ProtobufComponent: {
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
}
