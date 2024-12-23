import { buildRouteMap } from "@stricli/core";
import { AwsCodebuildRouteMap } from "./codebuild/AwsCodebuildRoutemap.mjs";
import { AwsCodecatalystRoutemap } from "./codecatalyst/AwsCodecatalystRoutemap.mjs";
import { AwsOrganizationRoutemap } from "./organization/AwsOrganizationRoutemap.mjs";
import { AwsPulumiRouteMap } from "./pulumi/AwsPulumiRoutemap.mjs";

export const AwsRoutemap = async () => {
	const [
		prepareOrganization,
		prepareCodebuild,
		prepareCodecatalyst,
		preparePulumi,
	] = await Promise.all([
		AwsOrganizationRoutemap(),
		AwsCodebuildRouteMap(),
		AwsCodecatalystRoutemap(),
		AwsPulumiRouteMap(),
	]);

	const [organization, codebuild, codecatalyst, pulumi] = await Promise.all([
		prepareOrganization(),
		prepareCodebuild(),
		prepareCodecatalyst(),
		preparePulumi(),
	]);

	return async () =>
		buildRouteMap({
			aliases: {
				org: "organization",
				catalyst: "codecatalyst",
				codeb: "codebuild",
				state: "pulumi",
				// codec: "codecommit",
				// codep: "codepipeline",
				// codea: "codeartifact",
			},
			routes: {
				organization,
				codebuild,
				codecatalyst,
				pulumi,
			},
			docs: {
				brief:
					"Commands to deploy specific AWS resources under an organization. To start, explore the organization commands",
			},
		});
};
