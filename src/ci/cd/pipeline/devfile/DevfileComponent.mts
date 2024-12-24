``;

// Component
export type DevfileComponent<Component extends string> = {
	name: Component;
	container?: {
		image: string;
		mountSources?: boolean;
		command?: string[];
	};
};

export class DevfileComponentBuilder<Component extends string> {
	private container: DevfileComponent<Component>["container"];

	constructor(private name: Component) {}

	setName(name: Component): this {
		this.name = name;
		return this;
	}

	setContainer(container: DevfileComponent<Component>["container"]): this {
		this.container = container;
		return this;
	}

	build() {
		return { name: this.name, container: this.container };
	}
}

export type DevfileComponentProps<Component extends string> = {
	name: Component;
	container?: {
		image: string;
		mountSources?: boolean;
		command?: string[];
	};
};

export const DevfileComponentX = <Component extends string>(
	props: DevfileComponentProps<Component>,
): DevfileComponentBuilder<Component> => {
	return new DevfileComponentBuilder(props.name).setContainer(props.container);
};
