import { AwsOrganizationPrincipalFARParameter } from "../../../commands/aws/organization/AwsOrganizationPrincipalCommand.mjs";
import { RunAwsPrincipalAssumeSequence } from "./AwsPrincipalAssumeSequence.mjs";

export const RunAwsPrincipalFarAssumeSequence = async ({
	principal,
	region,
}: {
	principal: string;
	region: string;
}) =>
	await RunAwsPrincipalAssumeSequence({
		region,
		principal,
		role: {
			parameter: AwsOrganizationPrincipalFARParameter,
		},
		help: {
			resolution:
				"Please run `fourtwo aws organization principal` to initialize the required role.",
			reminder: `Please verify you are using the correct principal or prefix (currently ${principal}). Fourtwo will try to infer the principal from the package.json file.`,
		},
	});
