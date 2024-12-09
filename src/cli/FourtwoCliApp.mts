import { buildApplication, buildRouteMap } from "@stricli/core";
import { AwsRoutemap } from "./commands/aws/AwsRoutemap.mjs";

export const FourtwoCliApp = async () => {
	const routemap = [["aws", await AwsRoutemap()]] as const;

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
				brief: "All available commands",
			},
		}),
		{
			name: "fourtwo",
		},
	);
};
