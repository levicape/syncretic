import { DevfileMetadataBuilder } from "../../ci/cd/pipeline/devfile/DevfileMetadata.mts";

export type DevfileMetadataProps = {
	name: string;
};
export const DevfileMetadata = (
	props: DevfileMetadataProps,
): DevfileMetadataBuilder => {
	return new DevfileMetadataBuilder(props.name);
};
