import { execSync } from "node:child_process";
import path, { resolve } from "node:path";
import { Command } from "@pulumi/command/local/command.js";
import { Image } from "@pulumi/docker-build/index.js";
import {
	type ComponentResourceOptions,
	Output,
	type UnwrappedObject,
	all,
	concat,
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
import type {
	ComputeComponentBuildProps,
	ComputeComponentBuildResult,
} from "../ComputeComponent.js";
import { ComputeDockerImage } from "../ComputeDockerImage.js";
import type { ProtobufArtifactLayer } from "../protocol/ProtobufArtifactLayer.js";
import type { ProtobufArtifacts } from "../protocol/ProtocolComponent.js";
import type { BunComponentDockerProps } from "./BunComponent.js";

type CopyFrom = ComputeComponentBuildProps["copyFrom"];

export type BunArtifactLayerProps<
	Protocols extends ProtobufArtifacts<
		string,
		ProtobufArtifactLayer
	> = ProtobufArtifacts<string, ProtobufArtifactLayer>,
> = {
	context: Context;
	protocolLanguage?: "node" | "typescript" | "web";
	docker: BunComponentDockerProps;
	// Determines whether the Image resource is created
	suppressBuild?: boolean;
	copyBun?: boolean;
	installDevDependencies?: boolean;
} & ComputeArtifactLayerProps<Protocols>;

export type BunArtifactLayerResult = {
	bunVersion: string;
} & ComputeComponentBuildResult;

export type BunArtifactLayerInitial<
	Protocols extends ProtobufArtifacts<
		string,
		ProtobufArtifactLayer
	> = ProtobufArtifacts<string, ProtobufArtifactLayer>,
> = {
	bunVersion: `1.1.${"30" | "32" | "34"}` | "1.1";
	context?: Context;
	protocolLanguage?: "node" | "typescript" | "web";
} & ComputeArtifactLayerInitial<Protocols>;
export type BunArtifactLayerInitialized = ComputeArtifactLayerInitialized & {
	bunVersion: string;
};
export type BunArtifactLayerState = {
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
	service: {
		port: string;
	};
};

export class BunArtifactLayer extends ComputeArtifactLayer<BunArtifactLayerInitialized> {
	static readonly URN: `compute:${string}:bun:layer` =
		"compute:artifact:bun:layer";

	static readonly LATEST_BUN_VERSION = "1.1.34";

	current: BunArtifactLayerState;
	image?: Image;
	inline: Output<string>;

	constructor(
		public readonly name: string,
		props: BunArtifactLayerProps,
		data: BunArtifactLayerInitial,
		opts?: ComponentResourceOptions,
	) {
		super(BunArtifactLayer.URN, name, props, data, opts);

		// Pulumi already unwraps this promise
		const phase = "current";
		const initialized = Output.create(this.getData()).apply((data) => {
			console.debug({
				BunArtifactLayer: {
					message: "Received initalized BunArtifactLayer",
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
			{
				parent: this,
				replaceOnChanges: ["*"],
				deleteBeforeReplace: true,
			},
		);
		const buildTimestamp = new Static(
			`${name}-${phase}-build-time`,
			{
				triggers: {
					buildId: initialized.buildId,
					protobufVersion: initialized.bunVersion,
					protocols: Object.entries(props.protocols ?? {})
						.sort(([a], [b]) => a.localeCompare(b))
						.reduce((previous, [key, value]) => {
							let acc = previous;
							const { initialized } = value.current;
							const { buildId } = initialized;
							acc += `${key}-${buildId};`;
							return acc;
						}, ""),
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
			{ parent: rootTimestamp },
		);

		const current = {
			rootTimestamp,
			buildTimestamp,
			random,
			initialized,
			hash: interpolate`${initialized.rootId}-${initialized.buildId}-${random.result}`,
			service: {
				port: props.docker.port,
			},
		};

		this.current = current;

		const image = this.dockerImageResource(
			name,
			props,
			initialized,
			buildTimestamp,
		);
		const { dockerImage, inline } = image;
		this.inline = inline;
		this.image = dockerImage;

		this.registerOutputs({
			current,
			image,
			inline,
		});
	}

	protected async initialize(
		args: BunArtifactLayerInitial,
	): Promise<BunArtifactLayerInitialized> {
		const copyFrom = args.copyFrom as CopyFrom;
		const { bunVersion = "1.1.29" } = args;
		const rootId = (
			copyFrom.git?.url ??
			copyFrom.local?.path.split("/").pop()! ??
			"void"
		)
			.replaceAll("/", "_")
			.replaceAll(":", "-")
			.replaceAll("..", "");
		const buildId = await BunArtifactLayer.getSourceIdentifier(copyFrom);
		const tempDir = path.join(
			process.cwd(),
			"build",
			"temp",
			"build",
			"compute",
			"bun",
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
					"bun",
					buildId,
				);
				execSync(`mkdir -p ${tempContextPath}`);
			} catch (_) {}
		} else {
			root = path.join(
				process.cwd(),
				"build",
				"compute",
				"bun",
				rootId,
				buildId,
			);
			await BunArtifactLayer.cloneGitRepo(
				copyFrom.git?.url ?? "",
				copyFrom.git?.branch,
				tempDir,
			);
		}

		console.debug({
			BunArtifactLayer: {
				initialize: {
					root,
					rootId,
					buildId,
					tempDir,
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
		namespace: string,
		artifactProps: BunArtifactLayerProps,
		initialized: Output<UnwrappedObject<BunArtifactLayerInitialized>>,
		buildTimestamp: Static,
	): {
		dockerImage: Image | undefined;
		inline: Output<string>;
	} {
		const {
			srcRoot,
			suppressBuild,
			protocols,
			copyBun,
			context: { environment },
			installDevDependencies = true,
		} = {
			suppressBuild: false,
			...artifactProps,
		};

		const { isProd, features } = environment;
		const { buildId, bunVersion } = initialized;
		const {
			repository,
			prefix,
			name,
			cmd,
			entrypoint,
			sourcesBeforeInstall = true,
			build,
			port,
			buildCommand = "build",
		} = artifactProps.docker;
		const { url: repositoryUrl, credentials } = repository;

		const image = `${prefix}__${name}`;
		const tagged = interpolate`${image}:${buildId}`;
		const latest = `${image}:latest`;
		const url = interpolate`${repositoryUrl}/${tagged}`;
		const urllatest = interpolate`${repositoryUrl}/${latest}`;

		all([tagged, url]).apply(([tagged, url]) => {
			console.info({
				BunArtifactLayer: {
					message: "Generated image name and URL",
					image: tagged,
					url,
				},
			});
		});

		const tempContextPath = buildId.apply((id) => {
			return path.join(
				process.cwd(),
				"build",
				"temp",
				"artifact",
				"compute",
				"bun",
				id,
			);
		});

		const protocolVersionString = Object.entries(protocols ?? {})
			.sort(([a], [b]) => a.localeCompare(b))
			.reduce((previous, [key, value]) => {
				let acc = previous;
				const { initialized } = value.current;
				const { buildId } = initialized;
				acc = concat(acc, interpolate`${key}-${buildId};`);
				return acc;
			}, Output.create(""));

		const packageJsonExists = tempContextPath.apply(
			(tempContextPath: string) => {
				try {
					execSync(`test -f ${tempContextPath}/package.json`);
					// return last timestamp of package.json
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
					protocolVersionString,
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

		const protocolCopyCommand = new Command(
			`${name}-prepare-protocols`,
			{
				create: concat(
					...Object.entries(protocols ?? {})
						.map(([protocolName, protocol]) => {
							return all([
								protocol.image.context,
								protocol.commands?.buildCommand,
								protocol.current.initialized.buildId,
							]).apply(([imageContext, build, protocolBuildId]) => {
								const root = imageContext?.location;
								interpolate`{
		BunArtifactLayer: {
			protocol: {
				name: ${protocolName},
				root: ${root ?? "undefined"},	
				build: {
					message: "Protocol build command",
					stdout: ${build?.stdout ?? "undefined"},
					stderr: ${build?.stderr ?? "undefined"},
					interpreter: ${build?.interpreter ?? "undefined"},
					create: ${build?.create ?? "undefined"},
					delete: ${build?.delete ?? "undefined"},
					environment: ${build?.environment ?? "undefined"},
					stdin: ${build?.stdin ?? "undefined"},
				}
			}
		}
								}`.apply((inline) => {
									console.debug(inline);
								});

								const protoRoot = resolve(
									`${root}/../../images/${protocolBuildId}/artifact/protocols`,
								);

								const targetPath = concat(
									tempContextPath,
									"/",
									srcRoot,
									"/",
									"_protocols",
									"/",
									protocolName,
								);

								return interpolate`  
								 rm -rf ${targetPath}/*;
								 cp -r ${protoRoot}/gen/ts ${targetPath};
								 cp -r ${protoRoot}/gen/tsnode ${targetPath};
								 cp -r ${protoRoot}/gen/tsjson ${targetPath};
								 cp -r ${protoRoot}/gen/jsonschema ${targetPath};
								 cp -r ${protoRoot}/gen/docs ${targetPath};
								`;
							});
						})
						.flatMap((e) => [e, "\n"]),
				),
				dir: tempContextPath,
				triggers: [initialized.buildId, protocolVersionString],
			},
			{
				parent: buildTimestamp,
				replaceOnChanges: ["*"],
				deleteBeforeReplace: true,
				dependsOn: [
					copyCommand,
					...Object.values(protocols ?? {}).map((protocol) => protocol.image),
				],
			},
		);

		let dockerImage: Image;
		let inline: Output<string>;
		try {
			const [firstCmd, ...restCmd] = cmd.split(" ");
			const cmdStrings = (
				entrypoint !== "bun"
					? [`/app/${firstCmd}`, ...restCmd]
					: [firstCmd, ...restCmd]
			)
				.filter((e) => e !== "")
				.map((e) => `"${e}"`)
				.join(", ");

			inline = interpolate`
		FROM scratch AS base
		WORKDIR /artifact/base
		COPY package.json bun.lock[b] ./

		FROM scratch AS sources
		WORKDIR /artifact/sources
		COPY . .

		FROM oven/bun:${bunVersion} AS install
	${ComputeDockerImage.copy("base", "install")}
		WORKDIR /artifact/install
		# RUN apt-get update && apt-get install -y python3
	    CMD ["mkdir", "assets"] 
	    ENV BUN_INSTALL_CACHE_DIR=/tmp/bun/cache
		RUN mkdir -p /tmp/bun/cache
	${sourcesBeforeInstall === true ? ComputeDockerImage.copy("sources", "install") : ""}
		RUN bun install ${installDevDependencies ? "" : "--production"}

		FROM oven/bun:${bunVersion} AS appbuild
	${ComputeDockerImage.copy("install", "appbuild")}
	${sourcesBeforeInstall !== true ? ComputeDockerImage.copy("sources", "appbuild") : ""}
		WORKDIR /artifact/appbuild 
    	ENV BUN_INSTALL_CACHE_DIR=/tmp/bun/cache
		COPY --from=install /tmp/bun/cache /tmp/bun/cache
		ENV NODE_ENV=${isProd ? "production" : "development"}
	${build !== false ? `RUN bun run ${buildCommand}` : ""}
		${copyBun ? `RUN cp /usr/local/bin/bun ./build/bin` : ""}

		FROM oven/bun:${bunVersion} AS runtime
	${ComputeDockerImage.copy("appbuild", "", "app")}
		WORKDIR /app
	    ENV BUN_INSTALL_CACHE_DIR=/tmp/bun/cache		
		COPY --from=appbuild /tmp/bun/cache /tmp/bun/cache
	${isProd && !features.includes("k8s") ? "" : "ENV NODE_TLS_REJECT_UNAUTHORIZED=0"}
		EXPOSE ${port}
		ENTRYPOINT ["${entrypoint}"]
	${cmdStrings !== "" ? `CMD [${cmdStrings}]` : ""}
		HEALTHCHECK CMD curl --fail http://localhost:${port}/.well-known/healthcheck || exit 1
		`;

			if (suppressBuild) {
				return {
					dockerImage: undefined,
					inline,
				};
			}

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
							docker: {},
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
				{
					parent: buildTimestamp,
					dependsOn: [copyCommand, protocolCopyCommand],
				},
			);
		} catch (error) {
			console.error({
				BunArtifactLayer: {
					error: {
						error,
						string: error?.toString(),
						json: JSON.stringify(error),
					},
				},
			});
			throw error;
		}

		return {
			dockerImage,
			inline,
		};
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

	public static async getSourceIdentifier(copyFrom: CopyFrom): Promise<string> {
		if (copyFrom?.git) {
			return await BunArtifactLayer.getGitCommitSHA(
				copyFrom.git.url,
				copyFrom.git.branch,
			);
		}
		if (copyFrom?.local) {
			return await BunArtifactLayer.getLocalPathHash(copyFrom.local.path);
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
