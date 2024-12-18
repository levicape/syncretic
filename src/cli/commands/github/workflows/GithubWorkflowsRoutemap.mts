import { buildRouteMap } from "@stricli/core";
import { GithubWorkflowsGenerateCommand } from "./GithubWorkflowsGenerateCommand.mjs";

export const GithubWorkflowsRoutemap = async () => {
	const [prepareGenerate] = await Promise.all([
		GithubWorkflowsGenerateCommand(),
	]);
	const [generate] = await Promise.all([prepareGenerate()]);

	return async () =>
		buildRouteMap({
			aliases: {
				gen: "generate",
			},
			routes: {
				// sync
				generate,
			},
			docs: {
				brief: "Commands to manage Github Action workflows",
			},
		});
};
