// Metadata
export type DevfileMetadata = {
	name: string;
};

export class DevfileMetadataBuilder {
	constructor(private name: string) {}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	build() {
		return { name: this.name };
	}
}

export type DevfileMetadataProps = {
	name: string;
};
export const DevfileMetadataX = (
	props: DevfileMetadataProps,
): DevfileMetadataBuilder => {
	return new DevfileMetadataBuilder(props.name);
};
