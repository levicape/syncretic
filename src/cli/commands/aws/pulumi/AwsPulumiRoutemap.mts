import { buildRouteMap } from "@stricli/core";
import { AwsPulumiBackendCommand } from "./AwsPulumiBackendCommand.mjs";

export const AwsPulumiRouteMap = async () => {
	const [prepareCodebuildGithubRoutemap] = await Promise.all([
		AwsPulumiBackendCommand(),
	]);

	const [backend] = await Promise.all([prepareCodebuildGithubRoutemap()]);

	return async () =>
		buildRouteMap({
			aliases: {
				state: "backend",
				s3: "backend",
			},
			routes: {
				backend,
			},
			docs: {
				brief: "Commands to manage pulumi state on AWS.",
			},
		});
};
