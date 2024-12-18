import { buildRouteMap } from "@stricli/core";
import { AwsOrganizationInitCommand } from "./AwsOrganizationInitCommand.mjs";
import { AwsOrganizationPrincipalCommand } from "./AwsOrganizationPrincipalCommand.mjs";

export const AwsOrganizationRoutemap = async () => {
	const [prepareOrganizationInit, preparePrincipal] = await Promise.all([
		AwsOrganizationInitCommand(),
		AwsOrganizationPrincipalCommand(),
	]);

	const [init, principal] = await Promise.all([
		prepareOrganizationInit(),
		preparePrincipal(),
	]);

	return async () =>
		buildRouteMap({
			routes: {
				init,
				principal,
			},
			docs: {
				brief:
					"Commands to create and manage the AWS Organization and it's associated accounts for the current AWS profile.",
			},
		});
};
