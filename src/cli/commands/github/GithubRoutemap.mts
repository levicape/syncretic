import { buildRouteMap } from "@stricli/core";
import { GithubWorkflowsRoutemap } from "./workflows/GithubWorkflowsRoutemap.mjs";

export const GithubRoutemap = async () => {
	const [prepareWorkflows] = await Promise.all([GithubWorkflowsRoutemap()]);
	const [workflows] = await Promise.all([prepareWorkflows()]);

	return async () =>
		buildRouteMap({
			aliases: {
				workflow: "workflows",
				wf: "workflows",
				// co: "chatops",
			},
			routes: {
				workflows,
				// chatops,
			},
			docs: {
				brief: "Commands to interact with Github Actions",
			},
		});
};
