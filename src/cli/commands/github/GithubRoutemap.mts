import { buildRouteMap } from "@stricli/core";
import { WorkflowsRoutemap } from "./pipeline/WorkflowsRoutemap.mjs";

export const GithubRoutemap = async () => {
	const [prepareWorkflows] = await Promise.all([WorkflowsRoutemap()]);
	const [workflows] = await Promise.all([prepareWorkflows()]);

	return async () =>
		buildRouteMap({
			routes: {
				workflows,
				// chatops,
			},
			docs: {
				brief: "Commands to interact with Github Actions",
			},
		});
};
