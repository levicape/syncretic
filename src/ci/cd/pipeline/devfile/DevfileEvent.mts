///// Event
export type DevfileEvent<Id extends string> = {
	postStart: NoInfer<Id>[];
};

export class DevfileEventBuilder<Id extends string> {
	private postStart: DevfileEvent<Id>["postStart"];

	setPostStart(postStart: NoInfer<Id>[]): this {
		this.postStart = postStart;
		return this;
	}

	build() {
		return { postStart: this.postStart };
	}
}

export type DevfileEventProps<Id extends string> = {
	postStart: NoInfer<Id>[];
};

export const DevfileEventX = <Id extends string>(
	props: DevfileEventProps<Id>,
): DevfileEventBuilder<Id> => {
	return new DevfileEventBuilder<Id>().setPostStart(props.postStart);
};
