import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Image } from "@pulumi/docker-build/index.js";
import { Output } from "@pulumi/pulumi/index.js";
import { isDryRun } from "@pulumi/pulumi/runtime/settings.js";
import type { Context } from "../../../../context/Context.js";
import { AwsDockerImage } from "../../../aws/AwsDockerImage.js";
import {
	type ComputeComponentDockerProps,
	ComputeDockerImage,
	type ComputeDockerImageHandlerResult,
} from "../../ComputeDockerImage.js";
import type { JavaJvmComponentBuildResult } from "./JavaJvmComponent.js";

export type JavaComponentDockerProps = ComputeComponentDockerProps<
	"java -jar" | "java"
>;

export class JavaJvmDockerImage {
	static async fromBuild(
		{ prefix: stack }: Context,
		buildResult: JavaJvmComponentBuildResult,
		dockerProps: JavaComponentDockerProps,
	): Promise<ComputeDockerImageHandlerResult> {
		const { root: buildPath, buildId, version } = buildResult;
		const { repository, prefix, name, cmd, entrypoint, port } = {
			...dockerProps,
		};
		const { url: repositoryUrl, credentials } = repository;

		if (!buildPath) {
			console.error({
				JavaJvmDockerImage: {
					error: "Build path not found in ComputeComponentBuildResult.",
				},
			});
			throw new Error("Build path not found in JavaJvmComponentBuildResult.");
		}

		// Generate unique image name and URL
		const image = `${prefix}__${name}`;
		const tagged = `${image}:${buildId}`;
		const latest = `${image}:latest`;
		const url = `${repositoryUrl}/${tagged}`;
		const urllatest = `${repositoryUrl}/${latest}`;

		console.info({
			JavaJvmDockerImage: {
				message: "Generated image name and URL",
				image: tagged,
				url,
			},
		});

		let ref: Output<string>;

		if (isDryRun()) {
			ref = Output.create(url);
			console.info({
				JavaJvmDockerImage: {
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
			"javajvm",
			buildId,
		);

		const aws = new AwsDockerImage(entrypoint);
		const dockerfileContent = `
${ComputeDockerImage.base()}
${aws?.bootstrap(cmd) ?? ""}

    FROM ${version.image}
    COPY --from=base /app /app
${aws?.copy() ?? ""}      

    WORKDIR /app
    EXPOSE ${port}
    ENTRYPOINT [${entrypoint
			.split(" ")
			.map((e) => `"${e}"`)
			.join(", ")}]
    CMD ["/app/${cmd}"]
    HEALTHCHECK CMD curl --fail http://localhost:${port}/.well-known/healthcheck || exit 1
    `;

		if (!existsSync(tempContextPath)) {
			mkdirSync(tempContextPath, { recursive: true });
			console.debug({
				JavaJvmDockerImage: {
					buildId,
					message: "Created temporary context path",
					tempContextPath,
				},
			});
		}
		writeFileSync(path.join(tempContextPath, "Dockerfile"), dockerfileContent);
		console.debug({
			JavaJvmDockerImage: {
				buildId,
				message: "Dockerfile written",
				path: path.join(tempContextPath, "Dockerfile"),
			},
		});
		cpSync(buildPath, tempContextPath, { recursive: true });
		console.debug({
			JavaJvmDockerImage: {
				buildId,
				message: "Copied build files to temporary context path",
				tempContextPath,
			},
		});

		console.debug({
			JavaJvmDockerImage: {
				buildId,
				message: "Building Docker image",
				image: tagged,
				dockerfilePath: path.join(tempContextPath, "Dockerfile"),
			},
		});
		const dockerImage = new Image(
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

		// Cleanup
		dockerImage.digest.apply(() => {
			if (existsSync(tempContextPath)) {
				console.debug({
					JavaJvmDockerImage: {
						buildId,
						message: "Cleaned up temporary context path",
						tempContextPath,
						output: execSync(
							`rm -rf ${path.join(process.cwd(), "temp", "docker", "compute", "javajvm", buildId, "/")};`,
							{ encoding: "ascii" },
						),
					},
				});
			}
		});

		console.debug({
			JavaJvmDockerImage: {
				buildId,
				message: "Docker image successfully built and pushed",
				image: tagged,
				repositoryUrl,
			},
		});

		return {
			name,
			image,
			url,
			ref: dockerImage.tags.apply((tags) => tags!.at(0)!),
			buildId,
			build: buildResult,
			port,
		};
	}
}
