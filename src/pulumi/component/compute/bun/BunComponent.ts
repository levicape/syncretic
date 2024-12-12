import {
	ComputeComponent,
	type ComputeComponentBuildProps,
} from "../ComputeComponent.js";
import type { ComputeComponentDockerProps } from "../ComputeDockerImage.js";
import type {
	ProtocolComponentBuildResult,
	ProtocolMap,
} from "../protocol/ProtocolComponent.js";

export interface BunComponentDockerProps
	extends ComputeComponentDockerProps<"bun" | "/bin/sh"> {
	build?: boolean;
	buildCommand?: string;
	sourcesBeforeInstall?: boolean;
}

export type BunComponentBuildProps<
	Protocols extends ProtocolMap<
		string,
		ProtocolComponentBuildResult
	> = ProtocolMap<string, ProtocolComponentBuildResult>,
> = {
	bunVersion: "1.1.29" | "1.1";
	protocolLanguage?: "node" | "typescript" | "web";
} & ComputeComponentBuildProps<Protocols>;

export class BunComponent extends ComputeComponent {
	static readonly URN: `compute:${string}::bun` = "compute:*::bun";

	private _time = Date.now().toString();
}
