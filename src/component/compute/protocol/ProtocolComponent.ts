import type { ComputeComponentBuildResult } from "../ComputeComponent.js";
import type { ProtobufArtifactLayer } from "./ProtobufArtifactLayer.js";

export interface ProtocolComponentBuildProps {
	copyFrom: {
		git?: {
			url: string;
			branch?: string;
		};
		local?: {
			path: string;
		};
	};
	environment?: { [k: string]: string };
}

export interface ProtocolComponentBuildResult
	extends ComputeComponentBuildResult {
	protocolDir: string;
}
export type ProtocolMap<
	ProtocolName extends string,
	ProtocolResult extends ProtocolComponentBuildResult,
> = Record<ProtocolName, ProtocolResult>;

export type ProtobufArtifacts<
	ProtocolName extends string,
	ProtocolResult extends ProtobufArtifactLayer,
> = Record<ProtocolName, ProtocolResult>;
