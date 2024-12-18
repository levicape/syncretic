import { buildRouteMap } from "@stricli/core";
import { AwsCodebuildGithubRoutemap } from "./github/AwsCodebuildGithubRoutemap.mjs";

export const AwsCodebuildRouteMap = async () => {
	const [prepareCodebuildGithubRoutemap] = await Promise.all([
		AwsCodebuildGithubRoutemap(),
	]);

	const [github] = await Promise.all([prepareCodebuildGithubRoutemap()]);

	return async () =>
		buildRouteMap({
			aliases: {
				gh: "github",
			},
			routes: {
				github,
			},
			docs: {
				brief:
					"Commands to manage AWS Codebuild projects and associated repositories.",
			},
		});
};
