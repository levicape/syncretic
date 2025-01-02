import type { Region } from "./CodePipelineDefinition.mjs";

export type CodePipelineArtifactStore = {
	location: unknown;
	type: unknown;
	encryptionKey?: {
		location: unknown;
		type: unknown;
	};
};

export class CodePipelineArtifactStoreBuilder {
	private region?: Region;
	private location: unknown;
	private type: unknown;
	private encryptionKey?: {
		location: unknown;
		type: unknown;
	};

	getRegion(): Region | undefined {
		return this.region;
	}

	setRegion(region: Region): this {
		this.region = region;
		return this;
	}

	setLocation(location: unknown): this {
		this.location = location;
		return this;
	}

	setType(type: unknown): this {
		this.type = type;
		return this;
	}

	setEncryptionKey({
		location,
		type,
	}: { location: unknown; type: unknown }): this {
		this.encryptionKey = { location, type };
		return this;
	}

	build(): CodePipelineArtifactStore {
		const encryptionKey = this.encryptionKey
			? {
					encryptionKey: this.encryptionKey,
				}
			: {};

		return {
			type: this.type,
			location: this.location,
			...encryptionKey,
		};
	}
}
