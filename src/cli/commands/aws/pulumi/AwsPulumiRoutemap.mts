import { buildRouteMap } from "@stricli/core";
import { AwsPulumiBackendCommand } from "./AwsPulumiBackendCommand.mjs";
import { AwsPulumiCiCommand } from "./AwsPulumiCiCommand.mjs";

export const AwsPulumiRouteMap = async () => {
	const [preparePulumiBackendCommand, preparePulumiCiCommand] =
		await Promise.all([AwsPulumiBackendCommand(), AwsPulumiCiCommand()]);

	const [backend, ci] = await Promise.all([
		preparePulumiBackendCommand(),
		preparePulumiCiCommand(),
	]);

	return async () =>
		buildRouteMap({
			aliases: {
				state: "backend",
				s3: "backend",
			},
			routes: {
				backend,
				ci,
			},
			docs: {
				brief: "Commands to manage pulumi state on AWS.",
			},
		});
};
