import { DevfileBuilder } from "../../ci/cd/pipeline/devfile/Devfile.mts";
import type { DevfileCommandBuilder } from "../../ci/cd/pipeline/devfile/DevfileCommand.mts";
import type { DevfileComponentBuilder } from "../../ci/cd/pipeline/devfile/DevfileComponent.mts";
import type { DevfileEventBuilder } from "../../ci/cd/pipeline/devfile/DevfileEvent.mts";
import type { DevfileMetadataBuilder } from "../../ci/cd/pipeline/devfile/DevfileMetadata.mts";

export type DevfileProps<Id extends string, Component extends string> = {
	metadata: DevfileMetadataBuilder;
	components: DevfileComponentBuilder<Component>[];
	children?: DevfileCommandBuilder<Id> | DevfileCommandBuilder<Id>[];
	events: DevfileEventBuilder<Id>;
};

export const Devfile = <Id extends string, Component extends string>(
	props: DevfileProps<Id, Component>,
): DevfileBuilder => {
	let builder = new DevfileBuilder()
		.setMetadata(props.metadata)
		.setComponents(props.components)
		.setEvents(props.events);

	if (props.children) {
		builder.setCommands(
			Array.isArray(props.children) ? props.children : [props.children],
		);
	}
	return builder;
};

export * from "../../ci/cd/pipeline/devfile/Devfile.mts";
export * from "./DevfileCommand.mts";
export * from "./DevfileComponent.mts";
export * from "./DevfileEvent.mts";
export * from "./DevfileMetadata.mts";
