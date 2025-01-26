import {
	type CommandContext,
	type RouteMap,
	buildRouteMap,
} from "@stricli/core";
import { AwsCodecatalystWorkflowsGenerateCommand } from "./AwsCodecatalystWorkflowsGenerateCommand.mjs";

export const AwsCodecatalystWorkflowsRoutemap = async (): Promise<
	() => Promise<RouteMap<CommandContext>>
> => {
	const [prepareGenerate] = await Promise.all([
		AwsCodecatalystWorkflowsGenerateCommand(),
	]);

	const [generate] = await Promise.all([prepareGenerate()]);

	return async () =>
		buildRouteMap({
			defaultCommand: "generate",
			aliases: {
				gen: "generate",
				// env: "environment",
			},
			routes: {
				generate,
			},
			docs: {
				brief: "Commands for AWS Codecatalyst workflow generation.",
			},
		});
};
