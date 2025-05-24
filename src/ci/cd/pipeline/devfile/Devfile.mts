import type {
	DevfileCommand,
	DevfileCommandBuilder,
} from "./DevfileCommand.mjs";
import type {
	DevfileComponent,
	DevfileComponentBuilder,
} from "./DevfileComponent.mjs";
import type { DevfileEvent, DevfileEventBuilder } from "./DevfileEvent.mjs";
import type {
	DevfileMetadata,
	DevfileMetadataBuilder,
} from "./DevfileMetadata.mjs";

export type DevfileResource<Id extends string, Component extends string> = {
	schemaVersion: "2.0.0";
	metadata: DevfileMetadata;
	components: DevfileComponent<Component>[];
	commands: DevfileCommand<Id>[];
	events: DevfileEvent<Id>;
};

export class DevfileBuilder {
	private metadata: DevfileMetadataBuilder;
	private components: DevfileComponentBuilder<string>[];
	private commands: DevfileCommandBuilder<string>[];
	private events: DevfileEventBuilder<string>;

	setMetadata(metadata: DevfileMetadataBuilder): this {
		this.metadata = metadata;
		return this;
	}

	setComponents(components: DevfileComponentBuilder<string>[]): this {
		this.components = components;
		return this;
	}

	setCommands(commands: DevfileCommandBuilder<string>[]): this {
		this.commands = commands;
		return this;
	}

	setEvents(events: DevfileEventBuilder<string>): this {
		this.events = events;
		return this;
	}

	build() {
		return {
			schemaVersion: "2.0.0",
			metadata: this.metadata.build(),
			components: this.components.map((component) => component.build()),
			commands: this.commands.map((command) => command.build()),
			events: this.events.build(),
		};
	}
}
