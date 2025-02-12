import { DevfileBuilder } from "../../ci/cd/pipeline/devfile/Devfile.mjs";
import type { DevfileCommandBuilder } from "../../ci/cd/pipeline/devfile/DevfileCommand.mjs";
import type { DevfileComponentBuilder } from "../../ci/cd/pipeline/devfile/DevfileComponent.mjs";
import type { DevfileEventBuilder } from "../../ci/cd/pipeline/devfile/DevfileEvent.mjs";
import type { DevfileMetadataBuilder } from "../../ci/cd/pipeline/devfile/DevfileMetadata.mjs";

export type DevfileProps<Id extends string, Component extends string> = {
	metadata: DevfileMetadataBuilder;
	components: DevfileComponentBuilder<Component>[];
	children?: DevfileCommandBuilder<Id> | DevfileCommandBuilder<Id>[];
	events: DevfileEventBuilder<Id>;
};

export const DevfileX = <Id extends string, Component extends string>(
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
