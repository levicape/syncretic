import { DevfileEventBuilder } from "../../ci/cd/pipeline/devfile/DevfileEvent.mts";

export type DevfileEventProps<Id extends string> = {
	postStart: NoInfer<Id>[];
};

export const DevfileEvent = <Id extends string>(
	props: DevfileEventProps<Id>,
): DevfileEventBuilder<Id> => {
	return new DevfileEventBuilder<Id>().setPostStart(props.postStart);
};
