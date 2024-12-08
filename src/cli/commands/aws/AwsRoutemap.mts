import { buildRouteMap } from "@stricli/core";
import { DeveloperCommand } from "./DeveloperCommand.mjs";
import { OrganizationCommand } from "./OrganizationCommand.mjs";
import { PrincipalCommand } from "./PrincipalCommand.mjs";

export const AwsRoutemap = async () => {
	const [prepareOrganization, preparePrincipal, prepareDeveloper] =
		await Promise.all([
			OrganizationCommand(),
			PrincipalCommand(),
			DeveloperCommand(),
		]);

	const [organization, principal, developer] = await Promise.all([
		prepareOrganization(),
		preparePrincipal(),
		prepareDeveloper(),
	]);

	return async () =>
		buildRouteMap({
			routes: {
				organization,
				principal,
				developer,
			},
			docs: {
				brief: "Commands to deploy specific AWS resources",
			},
		});
};
