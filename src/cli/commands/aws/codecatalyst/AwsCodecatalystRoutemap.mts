import { buildRouteMap } from "@stricli/core";
import { AwsCodecatalystWorkflowsRoutemap } from "./workflows/AwsCodecatalystWorkflowsRoutemap.mjs";

export const AwsCodecatalystRoutemap = async () => {
	const [prepareWorkflows] = await Promise.all([
		AwsCodecatalystWorkflowsRoutemap(),
	]);

	const [workflows] = await Promise.all([prepareWorkflows()]);

	return async () =>
		buildRouteMap({
			aliases: {
				wf: "workflows",
			},
			routes: {
				workflows,
			},
			docs: {
				brief: "Commands for AWS Codecatalyst workflow generation.",
			},
		});
};
