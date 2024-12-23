import { AwsOrganizationPrincipalOAAParameter } from "../../../commands/aws/organization/AwsOrganizationPrincipalCommand.mjs";
import { RunAwsPrincipalAssumeSequence } from "./AwsPrincipalAssumeSequence.mjs";

export const RunAwsPrincipalOaaAssumeSequence = async ({
	principal,
	region,
}: {
	principal: string;
	region: string;
}) =>
	RunAwsPrincipalAssumeSequence({
		region,
		principal,
		role: {
			parameter: AwsOrganizationPrincipalOAAParameter,
		},
		help: {
			resolution:
				"Please run `fourtwo aws principal` to initialize the required role.",
			reminder: `Please verify you are using the correct principal flag (currently ${principal}).`,
		},
	});
