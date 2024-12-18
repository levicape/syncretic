import { buildRouteMap } from "@stricli/core";
import { AwsCodecatalystWorkflowsGenerateCommand } from "./AwsCodecatalystWorkflowsGenerateCommand.mjs";

export const AwsCodecatalystWorkflowsRoutemap = async () => {
	const [prepareGenerate] = await Promise.all([
		AwsCodecatalystWorkflowsGenerateCommand(),
	]);

	const [generate] = await Promise.all([prepareGenerate()]);

	return async () =>
		buildRouteMap({
			defaultCommand: "generate",
			aliases: {
				gen: "generate",
			},
			routes: {
				generate,
			},
			docs: {
				brief: "Commands for AWS Codecatalyst workflow generation.",
			},
		});
};
