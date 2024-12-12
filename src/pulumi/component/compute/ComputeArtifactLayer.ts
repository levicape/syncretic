import {
	ComponentResource,
	type ComponentResourceOptions,
	type Input,
	type Inputs,
} from "@pulumi/pulumi/index.js";
import type { ProtobufArtifactLayer } from "./protocol/ProtobufArtifactLayer.js";
import type { ProtobufArtifacts } from "./protocol/ProtocolComponent.js";

export interface ComputeArtifactLayerProps<
	Protocols extends ProtobufArtifacts<
		string,
		ProtobufArtifactLayer
	> = ProtobufArtifacts<string, ProtobufArtifactLayer>,
> {
	srcRoot: string;
	prefix: string;
	handler?: string;
	envs?: { [k: string]: string };
	protocols?: Protocols;
}

export interface ComputeArtifactLayerInitial<
	Protocols extends ProtobufArtifacts<
		string,
		ProtobufArtifactLayer
	> = ProtobufArtifacts<string, ProtobufArtifactLayer>,
> {
	copyFrom: {
		git?: {
			url: string;
			branch?: string;
		};
		local?: {
			path: `${string}/`;
		};
	};
	srcRoot: string;
	handler?: string;
	envs?: { [k: string]: string };
	protocols?: Protocols;
}
export type ComputeArtifactLayerInitialized = {
	buildId: string;
	rootId: string;
	tempDir: string;
	root: string;
};

export interface ComputeArtifactLayerBuildResult {
	buildId: string;
	root: string;
}
export type ComputeArtifactLayerEnvSourceRef = {
	/**
	 * Name of the referent. This field is effectively required, but due to backwards compatibility is allowed to be empty.
	 * Instances of this type with an empty value here are almost certainly wrong.
	 * More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
	 */
	name?: Input<string>;
	/**
	 * Specify whether the resource must be defined
	 */
	optional?: Input<boolean>;
};
export type ComputeArtifactLayerEnvSource = {
	/**
	 * The ConfigMap to select from
	 */
	configMapRef?: Input<ComputeArtifactLayerEnvSourceRef>;
	/**
	 * An optional identifier to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER.
	 */
	prefix?: Input<string>;
	/**
	 * The Secret to select from
	 */
	secretRef?: Input<ComputeArtifactLayerEnvSourceRef>;
};

export class ComputeArtifactLayer<
	Data extends Inputs | undefined = ComputeArtifactLayerInitialized,
> extends ComponentResource<Data> {
	constructor(
		urn: string,
		name: string,
		props: Omit<ComputeArtifactLayerProps, "build"> & {
			build?: ComputeArtifactLayerBuildResult;
		},
		data: ComputeArtifactLayerInitial,
		opts?: ComponentResourceOptions,
	) {
		super(urn, name, data, opts);
	}
}
