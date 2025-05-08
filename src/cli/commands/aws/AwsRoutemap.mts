import { buildRouteMap } from "@stricli/core";
import { AwsCodecatalystRoutemap } from "./codecatalyst/AwsCodecatalystRoutemap.mjs";

export const AwsRoutemap = async () => {
	const [prepareCodecatalyst] = await Promise.all([AwsCodecatalystRoutemap()]);

	const [codecatalyst] = await Promise.all([prepareCodecatalyst()]);

	return async () =>
		buildRouteMap({
			aliases: {
				catalyst: "codecatalyst",
			},
			routes: {
				codecatalyst,
			},
			docs: {
				brief: "Commands to generate Codecatalyst workflows",
			},
		});
};
