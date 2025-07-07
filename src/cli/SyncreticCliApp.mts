import { buildApplication, buildRouteMap } from "@stricli/core";
import { AwsRoutemap } from "./commands/aws/AwsRoutemap.mjs";
import { GithubRoutemap } from "./commands/github/GithubRoutemap.mjs";

export const SyncreticCliApp = async () => {
	const routemap = [
		["aws", await AwsRoutemap()],
		["github", await GithubRoutemap()],
	] as const;

	const prepare = await Promise.all(
		routemap.map(async ([name, promise]) => {
			return [name, await promise()];
		}),
	);

	const routes = Object.fromEntries(prepare);

	return buildApplication(
		buildRouteMap({
			routes,
			docs: {
				brief: "syncretic is a CLI for generating resources from JSX templates",
			},
		}),
		{
			name: "syncretic",
		},
	);
};
