import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Image } from "@pulumi/docker-build/index.js";
import { Output } from "@pulumi/pulumi/index.js";
import { isDryRun } from "@pulumi/pulumi/runtime/settings.js";
import type { Context } from "../../../../context/Context.js";
import { AwsDockerImage } from "../../aws/AwsDockerImage.js";
import {
	type ComputeComponentDockerProps,
	ComputeDockerImage,
	type ComputeDockerImageHandlerResult,
} from "../ComputeDockerImage.js";
import type { NodejsComponentBuildResult } from "./NodejsComponent.js";

export type NodejsDockerImageProps = {
	install?: boolean;
} & ComputeComponentDockerProps<"node" | "npm" | "/bin/sh">;

export class NodejsDockerImage {
	static async fromBuild(
		{ prefix: stack, environment }: Context,
		buildResult: NodejsComponentBuildResult,
		dockerProps: NodejsDockerImageProps,
	): Promise<ComputeDockerImageHandlerResult> {
		const { isProd, features } = environment;
		const { root: buildPath, buildId, nodeVersion } = buildResult;
		const { repository, prefix, name, cmd, entrypoint, install, port } = {
			...dockerProps,
		};
		const { url: repositoryUrl, credentials } = repository;

		if (!buildPath) {
			console.error({
				NodeJsDockerImage: {
					error: "Build path not found in ComputeComponentBuildResult.",
				},
			});
			throw new Error("Build path not found in ComputeComponentBuildResult.");
		}

		const image = `${prefix}__${name}`;
		const tagged = `${image}:${buildId}`;
		const latest = `${image}:latest`;
		const url = `${repositoryUrl}/${tagged}`;
		const urllatest = `${repositoryUrl}/${latest}`;

		console.info({
			NodeJsDockerImage: {
				message: "Generated image name and URL",
				image: tagged,
				url,
			},
		});

		let ref: Output<string>;
		if (isDryRun()) {
			ref = Output.create(url);
			console.info({
				NodeJsDockerImage: {
					message: "Skipping build.",
					image: tagged,
					url,
					ref,
					buildId,
					build: buildResult,
					port,
				},
			});
			return {
				name,
				image: tagged,
				url,
				ref,
				buildId,
				build: buildResult,
				port,
			};
		}

		const tempContextPath = path.join(
			process.cwd(),
			"build",
			"temp",
			"docker",
			"compute",
			"nodejs",
			buildId,
		);
		const aws =
			entrypoint === "node" ? new AwsDockerImage(entrypoint) : undefined;
		const [firstCmd, ...restCmd] = cmd.split(" ");
		const cmdStrings = (
			entrypoint === "node"
				? [`/app/${firstCmd}`, ...restCmd]
				: [firstCmd, ...restCmd]
		)
			.filter((e) => e !== "")
			.map((e) => `"${e}"`)
			.join(", ");

		const dockerfileContent = `
${ComputeDockerImage.base()}
${aws?.bootstrap(cmd) ?? ""}

    FROM node:${nodeVersion}
${aws?.copy() ?? ""} 
${ComputeDockerImage.copy()}

    WORKDIR /app
    RUN apt-get update && apt-get install -y python3
    ${install === true ? `RUN npm install` : ""}
    ENV NODE_ENV=${isProd ? "production" : "development"}
    ${isProd && !features.includes("k8s") ? "" : "ENV NODE_TLS_REJECT_UNAUTHORIZED=0"}
    EXPOSE ${port}
    ENTRYPOINT ["${entrypoint}"]
    ${cmdStrings !== "" ? `CMD [${cmdStrings}]` : ""}
    HEALTHCHECK CMD curl --fail http://localhost:${port}/.well-known/healthcheck || exit 1
    `;

		if (!existsSync(tempContextPath)) {
			mkdirSync(tempContextPath, { recursive: true });
			console.debug({
				NodeJsDockerImage: {
					message: "Created temporary context path",
					tempContextPath,
				},
			});
		}
		writeFileSync(path.join(tempContextPath, "Dockerfile"), dockerfileContent);
		console.debug({
			NodeJsDockerImage: {
				message: "Dockerfile written",
				path: path.join(tempContextPath, "Dockerfile"),
			},
		});
		cpSync(buildPath, tempContextPath, { recursive: true });
		console.debug({
			NodeJsDockerImage: {
				message: "Copied build files to temporary context path",
				tempContextPath,
			},
		});

		console.debug({
			NodeJsDockerImage: {
				message: "Building Docker image",
				image: tagged,
				dockerfilePath: path.join(tempContextPath, "Dockerfile"),
			},
		});

		let dockerImage: Image;
		try {
			dockerImage = new Image(
				`${stack}-${name}-Image`,
				{
					tags: [url, urllatest],
					context: {
						location: tempContextPath,
					},
					dockerfile: {
						location: path.join(tempContextPath, "Dockerfile"),
					},
					exports: [
						{
							docker: {},
						},
					],
					cacheFrom: [
						{
							registry: {
								ref: urllatest,
							},
						},
					],
					cacheTo: [
						{
							inline: {},
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
				{ retainOnDelete: true },
			);
		} catch (error) {
			console.error({
				NodeJsDockerImage: {
					error: {
						error,
						string: error?.toString(),
						json: JSON.stringify(error),
					},
				},
			});
			throw error;
		}

		dockerImage.digest.apply(() => {
			if (existsSync(tempContextPath)) {
				console.debug({
					NodeJsDockerImage: {
						message: "Cleaned up temporary context path",
						tempContextPath,
						output: execSync(
							`rm -rf ${path.join(process.cwd(), "temp", "docker", "compute", "nodejs", buildId, "/")};`,
							{ encoding: "ascii" },
						),
					},
				});
			}
		});

		console.debug({
			NodeJsDockerImage: {
				message: "Docker image successfully built and pushed",
				image: tagged,
				repositoryUrl,
			},
		});

		return {
			name,
			image: tagged,
			url,
			ref: dockerImage.tags.apply((tags) => tags!.at(0)!),
			buildId,
			build: buildResult,
			port,
		};
	}
}
