import { DevfileMetadataBuilder } from "../../ci/cd/pipeline/devfile/DevfileMetadata.mjs";

export type DevfileMetadataProps = {
	name: string;
};
export const DevfileMetadataX = (
	props: DevfileMetadataProps,
): DevfileMetadataBuilder => {
	return new DevfileMetadataBuilder(props.name);
};
