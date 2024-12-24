import { DevfileEventBuilder } from "../DevfileEvent.mjs";

export type DevfileEventProps<Id extends string> = {
	postStart: NoInfer<Id>[];
};

export const DevfileEventX = <Id extends string>(
	props: DevfileEventProps<Id>,
): DevfileEventBuilder<Id> => {
	return new DevfileEventBuilder<Id>().setPostStart(props.postStart);
};
