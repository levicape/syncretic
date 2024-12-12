import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path, { resolve } from "node:path";
import { Command } from "@pulumi/command/local/command.js";
import { Image } from "@pulumi/docker-build/index.js";
import {
	type ComponentResourceOptions,
	Output,
	type UnwrappedObject,
	all,
	interpolate,
} from "@pulumi/pulumi/index.js";
import { RandomString } from "@pulumi/random/randomString.js";
import { Static } from "@pulumiverse/time/index.js";
import { hashElement } from "folder-hash";
import type { Context } from "../../../../context/Context.js";
import {
	ComputeArtifactLayer,
	type ComputeArtifactLayerInitial,
	type ComputeArtifactLayerInitialized,
	type ComputeArtifactLayerProps,
} from "../ComputeArtifactLayer.js";
import type { ComputeComponentBuildResult } from "../ComputeComponent.js";
import {
	type ComputeComponentDockerProps,
	ComputeDockerImage,
} from "../ComputeDockerImage.js";
import type {
	ProtobufArtifacts,
	ProtocolComponentBuildProps,
} from "./ProtocolComponent.js";

type CopyFrom = ProtocolComponentBuildProps["copyFrom"];

export interface ProtobufComponentDockerProps
	extends Omit<
		ComputeComponentDockerProps<string | never>,
		"entrypoint" | "cmd" | "port"
	> {
	build?: boolean;
	sourcesBeforeInstall?: boolean;
}

export type ProtobufArtifactLayerProps<
	Protocols extends ProtobufArtifacts<
		string,
		ProtobufArtifactLayer
	> = ProtobufArtifacts<string, ProtobufArtifactLayer>,
> = {
	context: Context;
	protocolLanguage?: "node" | "typescript" | "web";
	docker: Omit<ProtobufComponentDockerProps, "build" | "sourcesBeforeInstall">;
} & Omit<ComputeArtifactLayerProps<Protocols>, "srcRoot">;

export type ProtobufArtifactLayerResult = {
	bunVersion: string;
} & ComputeComponentBuildResult;

export type ProtobufArtifactLayerInitial<
	Protocols extends ProtobufArtifacts<
		string,
		ProtobufArtifactLayer
	> = ProtobufArtifacts<string, ProtobufArtifactLayer>,
> = {
	bunVersion: `1.1.${"30" | "32" | "34"}` | "1.1";
	context?: Context;
	protocolLanguage?: "node" | "typescript" | "web";
} & ComputeArtifactLayerInitial<Protocols>;
export type ProtobufArtifactLayerInitialized =
	ComputeArtifactLayerInitialized & {
		bunVersion: string;
	};
export type ProtobufArtifactLayerState = {
	hash: Output<string>;
	rootTimestamp: Static;
	buildTimestamp: Static;
	random: RandomString;
	initialized: {
		buildId: Output<string>;
		rootId: Output<string>;
		root: Output<string>;
		bunVersion: Output<string>;
	};
};

export class ProtobufArtifactLayer extends ComputeArtifactLayer<ProtobufArtifactLayerInitialized> {
	static readonly URN: `compute:${string}:protobuf:layer` =
		"compute:artifact:protobuf:layer";

	current: ProtobufArtifactLayerState;
	commands?: {
		copyCommand: Command;
		buildCommand?: Command;
	};
	image: Image;

	constructor(
		name: string,
		props: ProtobufArtifactLayerProps,
		data: ProtobufArtifactLayerInitial,
		opts?: ComponentResourceOptions,
	) {
		super(
			ProtobufArtifactLayer.URN,
			name,
			{
				...props,
				srcRoot: "",
			},
			data,
			opts,
		);

		const phase = "current";
		const initialized = Output.create(this.getData()).apply((data) => {
			console.debug({
				ProtobufArtifactLayer: {
					message: "Received initalized ProtobufArtifactLayer",
					data,
				},
			});
			return data;
		});

		const rootTimestamp = new Static(
			`${name}-${phase}-root-time`,
			{
				triggers: {
					rootId: initialized.rootId,
					protobufVersion: initialized.bunVersion,
				},
			},
			{ parent: this },
		);
		const buildTimestamp = new Static(
			`${name}-${phase}-build-time`,
			{
				triggers: {
					buildId: initialized.buildId,
					protobufVersion: initialized.bunVersion,
				},
			},
			{
				parent: rootTimestamp,
				replaceOnChanges: ["*"],
				deleteBeforeReplace: true,
			},
		);
		const random = new RandomString(
			`${name}-${phase}-root-random`,
			{
				length: 8,
				special: false,
			},
			{
				parent: rootTimestamp,
				replaceOnChanges: ["*"],
				deleteBeforeReplace: true,
			},
		);
		const current = {
			rootTimestamp,
			buildTimestamp,
			random,
			initialized,
			hash: interpolate`${initialized.rootId}-${initialized.buildId}-${random.result}`,
		};
		this.current = current;

		const tempContextPath = initialized.buildId.apply((id) => {
			return path.join(
				process.cwd(),
				"build",
				"temp",
				"artifact",
				"compute",
				"protobuf",
				id,
			);
		});

		const packageJsonExists = tempContextPath.apply(
			(tempContextPath: string) => {
				try {
					execSync(`test -f ${tempContextPath}/package.json`);
					const os = execSync("uname", { encoding: "ascii" }).toString().trim();
					if (os === "Darwin") {
						return execSync(`stat -f %m ${tempContextPath}/package.json`, {
							encoding: "utf-8",
						});
					}

					return execSync(`stat -c %Y ${tempContextPath}/package.json`, {
						encoding: "utf-8",
					});
				} catch (error) {}
				return Date.now().toString();
			},
		);

		const copyCommand = new Command(
			`${name}-prepare-context`,
			{
				create: interpolate`cp -r ${initialized.root.apply((root) => {
					return root;
				})} ${tempContextPath}; rm -rf ${tempContextPath}/node_modules; rm -rf ${tempContextPath}/.git;`,
				dir: tempContextPath,
				triggers: [
					initialized.buildId,
					packageJsonExists.apply((exists: string) => {
						return exists;
					}),
				],
			},
			{
				parent: buildTimestamp,
				replaceOnChanges: ["*"],
				deleteBeforeReplace: true,
			},
		);

		this.commands = {
			copyCommand,
		};

		const image = this.dockerImageResource(
			tempContextPath,
			copyCommand,
			name,
			props.context,
			initialized,
			props.docker,
			buildTimestamp,
		);
		this.image = image;

		this.registerOutputs({
			current,
			commands: this.commands,
			image,
		});
	}

	protected async initialize(
		args: ProtobufArtifactLayerInitial,
	): Promise<ProtobufArtifactLayerInitialized> {
		const copyFrom = args.copyFrom;
		const { bunVersion = "1.1.29" } = args;
		const rootId = (
			copyFrom.git?.url ??
			copyFrom.local?.path.split("/").pop()! ??
			"void"
		)
			.replaceAll("/", "_")
			.replaceAll(":", "-")
			.replaceAll("..", "");
		const buildId = await ProtobufArtifactLayer.getSourceIdentifier(copyFrom);
		const tempDir = path.join(
			process.cwd(),
			"build",
			"temp",
			"build",
			"compute",
			"protobuf",
			rootId,
			buildId,
		);

		let root = "";
		if (copyFrom.local) {
			root = copyFrom.local.path;
			try {
				const tempContextPath = path.join(
					process.cwd(),
					"build",
					"temp",
					"artifact",
					"compute",
					"protobuf",
					buildId,
				);
				execSync(`mkdir -p ${tempContextPath}`);
			} catch (_) {}
		} else {
			root = path.join(
				process.cwd(),
				"build",
				"compute",
				"protobuf",
				rootId,
				buildId,
			);

			await ProtobufArtifactLayer.cloneGitRepo(
				copyFrom.git?.url ?? "",
				copyFrom.git?.branch,
				tempDir,
			);
		}

		console.debug({
			ProtobufArtifactLayer: {
				initialize: {
					root,
					rootId,
					buildId,
					tempDir,
					copyFrom,
				},
			},
		});

		return {
			...super.initialize(args),
			...{
				buildId,
				rootId,
				tempDir,
				root,
				bunVersion,
			},
		};
	}

	protected dockerImageResource(
		tempContextPath: Output<string>,
		copyCommand: Command,
		namespace: string,
		_: Context,
		initialized: Output<UnwrappedObject<ProtobufArtifactLayerInitialized>>,
		dockerProps: ProtobufComponentDockerProps,
		buildTimestamp: Static,
	): Image {
		const { buildId, bunVersion } = initialized;
		const { repository, prefix, name } = {
			...dockerProps,
		};
		const { url: repositoryUrl, credentials } = repository;

		const image = `${prefix}__${name}`;
		const tagged = interpolate`${image}:${buildId}`;
		const latest = `${image}:latest`;
		const url = interpolate`${repositoryUrl}/${tagged}`;
		const urllatest = interpolate`${repositoryUrl}/${latest}`;

		all([tagged, url]).apply(([tagged, url]) => {
			console.info({
				ProtobufArtifactLayer: {
					message: "Generated image name and URL",
					image: tagged,
					url,
				},
			});
		});
		const outputPath = all([tempContextPath, buildId])
			.apply(([tempContextPath, id]) => {
				return resolve(`${tempContextPath}/../../images/${id}`);
			})
			.apply((path) => {
				mkdirSync(path, { recursive: true });
				return path;
			});

		let dockerImage: Image;
		try {
			const inline = interpolate`
		FROM scratch AS base
		WORKDIR /artifact/base
		COPY package.json bun.lockb .

		FROM oven/bun:${bunVersion} AS install
	${ComputeDockerImage.copy("base", "install")}
		WORKDIR /artifact/install
		ENV NODE_TLS_REJECT_UNAUTHORIZED=0
		RUN bun install

		FROM scratch AS sources
		WORKDIR /artifact/sources
		COPY . .		

		FROM node:${"22-alpine"} AS protocols
	${ComputeDockerImage.copy("install", "protocols")}
	${ComputeDockerImage.copy("sources", "protocols")}
		WORKDIR /artifact/protocols
		ENV NODE_ENV=production
		ENV NODE_TLS_REJECT_UNAUTHORIZED=0
		ENV BUN_CONFIG_VERBOSE_FETCH=1
		RUN echo $NODE_TLS_REJECT_UNAUTHORIZED
    	RUN npx buf generate
		`;
			dockerImage = new Image(
				`${namespace}-${name}-Image`,
				{
					buildOnPreview: false,
					tags: all([url, urllatest]),
					context: {
						location: tempContextPath,
					},
					dockerfile: {
						inline,
					},
					exports: [
						{
							local: {
								dest: outputPath,
							},
						},
					],
					cacheFrom: [
						{
							local: {
								src: "/tmp/leafcache",
							},
						},
					],
					cacheTo: [
						{
							local: {
								dest: "/tmp/leafcache",
							},
						},
					],
					platforms: ["linux/arm64"],
					push: false,
					...(credentials !== undefined
						? {
								registries: [
									{
										address: repositoryUrl,
										password: credentials?.basic?.password,
										username: credentials?.basic?.username,
									},
								],
							}
						: {}),
				},
				{ parent: buildTimestamp, dependsOn: copyCommand },
			);
		} catch (error) {
			console.error({
				ProtobufArtifactLayer: {
					error: {
						error,
						string: error?.toString(),
						json: JSON.stringify(error),
					},
				},
			});
			throw error;
		}

		return dockerImage;
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
				exclude: [
					"node_modules",
					".*",
					"test_coverage",
					"build",
					"*.ts",
					"*.tsx",
					"*.js",
					"*.jsx",
				],
			},
			files: {
				include: ["*.proto"],
			},
		});
		let hash = result.hash;
		while ([".", "-"].includes(hash[0])) {
			hash = `_${hash}`;
		}
		return hash;
	}

	public static async getSourceIdentifier(copyFrom: CopyFrom): Promise<string> {
		if (copyFrom?.git) {
			return await ProtobufArtifactLayer.getGitCommitSHA(
				copyFrom.git.url,
				copyFrom.git.branch,
			);
		}
		if (copyFrom?.local) {
			return await ProtobufArtifactLayer.getLocalPathHash(copyFrom.local.path);
		}
		throw new Error("Invalid copyFrom source.");
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
}
