import { buildRouteMap } from "@stricli/core";
import { AwsCodebuildGithubOidcCommand } from "./AwsCodebuildGithubOidcCommand.mjs";

export const AwsCodebuildGithubRoutemap = async () => {
	const [prepareGithubOidcCommand] = await Promise.all([
		AwsCodebuildGithubOidcCommand(),
	]);

	const [oidc] = await Promise.all([prepareGithubOidcCommand()]);

	return async () =>
		buildRouteMap({
			defaultCommand: "oidc",
			aliases: {
				link: "oidc",
			},
			routes: {
				oidc,
			},
			docs: {
				brief:
					"Commands to create and manage the current principal Codebuild project connections with a Github repository.",
			},
		});
};
