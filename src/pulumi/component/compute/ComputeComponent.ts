import {
	ComponentResource,
	type ComponentResourceOptions,
	type Input,
	type Output,
} from "@pulumi/pulumi/index.js";
import type { Context } from "../../../context/Context.js";
import type {
	ProtocolComponentBuildResult,
	ProtocolMap,
} from "./protocol/ProtocolComponent.js";

export interface ComputeComponentBuildProps<
	Protocols extends ProtocolMap<
		string,
		ProtocolComponentBuildResult
	> = ProtocolMap<string, ProtocolComponentBuildResult>,
> {
	executor: "DOCKER" | "SHELL";
	command: string;
	copyFrom: {
		git?: {
			url: string;
			branch?: string;
		};
		local?: {
			path: string;
		};
	};
	srcRoot: string;
	artifact: string;
	handler?: string;
	envs?: { [k: string]: string };
	protocols?: Protocols;
}
export interface ComputeComponentBuildResult {
	buildId: string;
	root: string;
}
export type ComputeComponentEnvSourceRef = {
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
export type ComputeComponentEnvSource = {
	/**
	 * The ConfigMap to select from
	 */
	configMapRef?: Input<ComputeComponentEnvSourceRef>;
	/**
	 * An optional identifier to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER.
	 */
	prefix?: Input<string>;
	/**
	 * The Secret to select from
	 */
	secretRef?: Input<ComputeComponentEnvSourceRef>;
};
export type ComputeComponentProps = {
	context: Context;
	build: ComputeComponentBuildResult;
	envs?: Output<{ [k: string]: string }>;
	memorySize?: string;
	retentionInDays?: number;
} & {
	envFrom?: Input<Array<Input<ComputeComponentEnvSource>>>;
};

export class ComputeComponent extends ComponentResource {
	constructor(
		urn: string,
		name: string,
		_: Omit<ComputeComponentProps, "build"> & {
			build?: ComputeComponentBuildResult;
		},
		opts?: ComponentResourceOptions,
	) {
		super(urn, name, {}, opts);
	}
}
