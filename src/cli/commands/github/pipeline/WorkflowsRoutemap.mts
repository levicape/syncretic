import { buildRouteMap } from "@stricli/core";
import { GenerateCommand } from "./GenerateCommand.mjs";

export const WorkflowsRoutemap = async () => {
	const [prepareGenerate] = await Promise.all([GenerateCommand()]);
	const [generate] = await Promise.all([prepareGenerate()]);

	return async () =>
		buildRouteMap({
			routes: {
				// sync
				gen: generate,
			},
			docs: {
				brief: "Commands to manage Github Action workflows",
			},
		});
};
