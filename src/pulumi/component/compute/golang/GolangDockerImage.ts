import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Image } from "@pulumi/docker-build/index.js";
import { Output } from "@pulumi/pulumi/index.js";
import { isDryRun } from "@pulumi/pulumi/runtime/settings.js";
import type { Context } from "../../../../context/Context.js";
import { DockerDomain } from "../../../domains/DockerDomain.js";
import { AwsDockerImage } from "../../aws/AwsDockerImage.js";
import {
	type ComputeComponentDockerProps,
	ComputeDockerImage,
	type ComputeDockerImageHandlerResult,
} from "../ComputeDockerImage.js";
import type { GolangComponentBuildResult } from "./GolangComponent.js";

export type GolangDockerImageHandlerResult = Omit<
	ComputeDockerImageHandlerResult,
	"build"
> & {
	build: GolangComponentBuildResult;
};
export type GolangComponentDockerProps<Entrypoint extends string> =
	ComputeComponentDockerProps<Entrypoint>;
export class GolangDockerImage {
	static async fromBuild<Entrypoint extends string>(
		{ prefix: stack, environment: { isProd } }: Context,
		buildResult: GolangComponentBuildResult,
		dockerProps: GolangComponentDockerProps<Entrypoint>,
	): Promise<GolangDockerImageHandlerResult> {
		const { root: buildPath, buildId } = buildResult;
		const { repository, prefix, name, cmd, entrypoint, port } = {
			...dockerProps,
		};
		const { url: repositoryUrl, credentials } = repository;

		if (!buildPath) {
			throw new Error("Build path not found in ComputeComponentBuildResult.");
		}

		// Generate unique image name and URL
		const image = `${prefix}__${name}`;
		const tagged = `${image}:${buildId}`;
		const latest = `${image}:latest`;
		const url = `${repositoryUrl}/${tagged}`;
		const urllatest = `${repositoryUrl}/${latest}`;

		// Set up output ref
		let ref: Output<string>;

		if (isDryRun()) {
			ref = Output.create(url);
			return {
				name,
				image,
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
			"golang",
			buildId,
		);

		const aws = new AwsDockerImage(entrypoint);
		const [firstCmd, ...restCmd] = cmd.split(" ");
		const cmdStrings = [firstCmd, ...restCmd]
			.filter((e) => e !== "")
			.map((e) => `"${e}"`)
			.join(", ");

		const dockerfileContent = `
${ComputeDockerImage.base()}
${aws?.bootstrap() ?? ""}
    
      FROM debian:bookworm AS runtime
${aws?.copy() ?? ""}
${ComputeDockerImage.copy()}

      WORKDIR /app
      ENV CGO_ENABLED=1
      ENV GIN_MODE=${isProd ? "release" : "debug"}
      EXPOSE ${port}
      ENTRYPOINT ["/app/${entrypoint}"]
      ${cmdStrings !== "" ? `CMD [${cmdStrings}]` : ""}
      HEALTHCHECK CMD curl --fail http://localhost:${port}/.well-known/healthcheck || exit 1      
    `;

		if (!existsSync(tempContextPath)) {
			mkdirSync(tempContextPath, { recursive: true });
		}
		writeFileSync(path.join(tempContextPath, "Dockerfile"), dockerfileContent);
		cpSync(buildPath, tempContextPath, { recursive: true });

		console.debug({
			GolangDockerImage: {
				buildId,
				message: `Building Docker image with Dockerfile`,
				image,
				dockerfileContent,
				tempContextPath,
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

		dockerImage.digest.apply(() => {
			if (existsSync(tempContextPath)) {
				console.debug({
					GolangDockerImage: {
						buildId,
						message: "Cleaned up temporary context path",
						tempContextPath,
						output: execSync(
							`rm -rf ${path.join(process.cwd(), "temp", "docker", "compute", "golang", buildId, "/")};`,
							{ encoding: "ascii" },
						),
					},
				});
			}
		});

		console.debug({
			GolangDockerImage: {
				buildId,
				message: `Docker image built`,
				image,
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

	static DEFAULT_ARCHITECTURE = DockerDomain.getInfo();
	static entrypoint = {
		fromBuild: ({ artifacts }: GolangComponentBuildResult["build"]) => {
			return {
				forThisArchitecture: async (
					info: ReturnType<
						typeof DockerDomain.getInfo
					> = GolangDockerImage.DEFAULT_ARCHITECTURE,
				) => {
					const { architecture, os } = await info;

					console.debug({
						GolangDockerImage: {
							message: `Select entrypoint`,
							architecture: {
								architecture,
								os,
							},
							artifacts,
						},
					});
					const artifact = artifacts.find((artifact) =>
						[architecture, os].every((requirement) => {
							return artifact.includes(requirement);
						}),
					);
					if (!artifact) {
						throw new Error(
							`No artifact found for architecture ${architecture} and OS ${os}. \n Possible artifacts: ${artifacts.join(",")}`,
						);
					}

					return artifact;
				},
			};
		},
	};
}
