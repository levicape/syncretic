import { DevfileMetadataBuilder } from "../DevfileMetadata.mjs";

export type DevfileMetadataProps = {
	name: string;
};
export const DevfileMetadataX = (
	props: DevfileMetadataProps,
): DevfileMetadataBuilder => {
	return new DevfileMetadataBuilder(props.name);
};
