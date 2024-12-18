import { buildRouteMap } from "@stricli/core";
import { AwsCodebuildRouteMap } from "./codebuild/AwsCodebuildRoutemap.mjs";
import { AwsCodecatalystRoutemap } from "./codecatalyst/AwsCodecatalystRoutemap.mjs";
import { AwsOrganizationRoutemap } from "./organization/AwsOrganizationRoutemap.mjs";

export const AwsRoutemap = async () => {
	const [prepareOrganization, prepareCodebuild, prepareCodecatalyst] =
		await Promise.all([
			AwsOrganizationRoutemap(),
			AwsCodebuildRouteMap(),
			AwsCodecatalystRoutemap(),
		]);

	const [organization, codebuild, codecatalyst] = await Promise.all([
		prepareOrganization(),
		prepareCodebuild(),
		prepareCodecatalyst(),
	]);

	return async () =>
		buildRouteMap({
			aliases: {
				org: "organization",
				catalyst: "codecatalyst",
				codeb: "codebuild",
				// codec: "codecommit",
				// codep: "codepipeline",
				// codea: "codeartifact",
			},
			routes: {
				organization,
				codebuild,
				codecatalyst,
			},
			docs: {
				brief:
					"Commands to deploy specific AWS resources under an organization. To start, explore the organization commands",
			},
		});
};
