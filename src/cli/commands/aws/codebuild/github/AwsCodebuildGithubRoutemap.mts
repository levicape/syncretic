import { buildRouteMap } from "@stricli/core";
import { AwsCodebuildGithubAuthCommand } from "./AwsCodebuildGithubAuthCommand.mjs";
import { AwsCodebuildGithubRunnerCommand } from "./AwsCodebuildGithubRunnerCommand.mjs";

export const AwsCodebuildGithubRoutemap = async () => {
	const routemap = [
		["runner", await AwsCodebuildGithubRunnerCommand()],
		["import-credentials", await AwsCodebuildGithubAuthCommand()],
	] as const;

	const prepare = await Promise.all(
		routemap.map(async ([name, promise]) => {
			return [name, await promise()];
		}),
	);

	const routes = Object.fromEntries(prepare);
	return async () =>
		buildRouteMap({
			aliases: {
				auth: "import-credentials",
				import: "import-credentials",
				credentials: "import-credentials",
				token: "import-credentials",
				login: "import-credentials",
				oidc: "runner",
				builder: "runner",
			},
			routes,
			docs: {
				brief:
					"Commands to create and manage project connections between Github and Codebuild.",
			},
		});
};
