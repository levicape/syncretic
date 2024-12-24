import { DevfileBuilder } from "../Devfile.mjs";
import type { DevfileCommandBuilder } from "../DevfileCommand.mjs";
import type { DevfileComponentBuilder } from "../DevfileComponent.mjs";
import type { DevfileEventBuilder } from "../DevfileEvent.mjs";
import type { DevfileMetadataBuilder } from "../DevfileMetadata.mjs";

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
