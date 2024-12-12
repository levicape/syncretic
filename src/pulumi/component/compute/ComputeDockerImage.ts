import type { Input, Output } from "@pulumi/pulumi/index.js";
import type { ComputeComponentBuildResult } from "./ComputeComponent.js";

type DockerImageUrlWithoutTag = string;
export interface ComputeComponentDockerProps<Entrypoint extends string> {
	repository: {
		url: string;
		credentials?: {
			basic?: {
				username: string;
				password: Input<string>;
			};
		};
	};
	name: DockerImageUrlWithoutTag;
	prefix: string;
	entrypoint: Entrypoint;
	cmd: string;
	port: string;
	service?: Array<{
		name: string;
		port: string;
		protocol: "http" | "ws";
	}>;
}

export type ComputeDockerImageHandlerResult = {
	name: string;
	image: string;
	port: string;
	url: string;
	ref: Output<string>;
	buildId: string;
	build: ComputeComponentBuildResult;
};

export class ComputeDockerImage {
	static BASE_IMAGE = "scratch";

	static base(): string {
		return `
    FROM ${ComputeDockerImage.BASE_IMAGE} AS base
    WORKDIR /app
    COPY . .
    `;
	}
	static copy(from = "base", to = "base", root = "artifact"): string {
		return `
      COPY --from=${from} /artifact/${from} ${root === "." ? "." : `/${root}`}${to.length > 0 ? `/${to}` : ""}
    `;
	}
}
