import type { LogLayerPlugin } from "loglayer";

export const UnixtimeLogPlugin: LogLayerPlugin = {
	id: "unixtime-plugin",
	onBeforeDataOut: ({ data }) => {
		if (data) {
			data.unixtime = Date.now();
		}
		return data;
	},
};
