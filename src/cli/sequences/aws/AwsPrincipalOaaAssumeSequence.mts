import { AwsClient } from "aws4fetch";
import VError from "verror";
import { AwsClientBuilder } from "../../../sdk/aws/AwsClientBuilder.mjs";
import { AwsRole } from "../../../sdk/aws/clients/AwsRole.mjs";
import { AwsSystemsManager } from "../../../sdk/aws/clients/AwsSystemsManager.mjs";
import { AwsSystemsManagerParameterGenerator } from "../../../sdk/aws/generators/AwsSystemsManagerParameterGenerator.mjs";
import {
	AwsOrganizationPrincipalOAAParameter,
	AwsOrganizationPrincipalOAARole,
} from "../../commands/aws/organization/AwsOrganizationPrincipalCommand.mjs";

export async function* AwsPrincipalOaaAssumeSequence({
	region,
	role,
	principal,
	root,
	roles,
}: {
	region: string;
	role?: string;
	principal: string;
	root: AwsSystemsManager;
	roles: AwsRole;
}) {
	yield { $$kind: "start" } as const;

	let parameters = AwsSystemsManagerParameterGenerator({
		root,
	});
	let start = await parameters.next();

	let oaaParameter = (
		await parameters.next({
			template: AwsOrganizationPrincipalOAAParameter,
			principal,
		})
	).value;

	if (oaaParameter.$$kind !== "loaded") {
		throw new VError(
			{
				name: "OAA",
				message: "OAA role parameter not loaded",
			},
			`OAA role parameter not loaded. ${JSON.stringify({
				oaaParameter,
				named: AwsOrganizationPrincipalOAAParameter(principal),
			})}`,
		);
	}

	console.dir({
		AwsPrincipalOaaAssumeSequence: {
			message: "Got OAA role parameter",
			oaaParameter,
		},
	});

	if (oaaParameter?.parameter.root.value === undefined) {
		throw new VError(
			{
				name: "OAA_NOT_FOUND",
				message: `OAA role not found`,
				info: {
					"Expected parameter": `${AwsOrganizationPrincipalOAAParameter(principal)}.`,
					Resolution:
						"Please run `fourtwo aws principal` to initialize the required role.",
					Principal: principal,
					Reminder:
						"Please verify you are using the correct --prefix flag (defaults to dev).",
				},
			},
			`OAA role not found. \n Expected parameter: ${AwsOrganizationPrincipalOAAParameter(principal)}.\n Please run \`fourtwo aws organization principal\` to initialize the required role.`,
		);
	}
	const oaaRole = oaaParameter?.parameter.root.value?.Parameter.Value;
	const account = oaaRole.split(":")[4];
	const serviceRole = role ?? AwsOrganizationPrincipalOAARole;

	yield {
		$$kind: "role",
		role: oaaParameter?.parameter.root.value?.Parameter.Value,
		account,
	} as const;

	const { AssumedRoleUser, Credentials } = (
		await roles.AssumeRole({
			RoleArn: `arn:aws:iam::${account}:role/${serviceRole}`,
			RoleSessionName: "FourtwoDeveloperCommand",
		})
	).AssumeRoleResult;

	console.dir(
		{
			AwsPrincipalOaaAssumeSequence: {
				message: "Assumed role",
				AssumedRoleUser,
			},
		},
		{ depth: null },
	);

	yield {
		$$kind: "assumed",
		assumed: {
			AccessKeyId: Credentials.AccessKeyId,
			SecretAccessKey: Credentials.SecretAccessKey,
			SessionToken: Credentials.SessionToken,
			region,
		},
	} as const;

	return { $$kind: "done" } as const;
}

export const RunAwsPrincipalOaaAssumeSequence = async ({
	principal,
	region,
	role,
}: {
	principal: string;
	region: string;
	role: string;
}) => {
	const credentials = await AwsClientBuilder.getAWSCredentials();
	const client = new AwsClient({
		...credentials,
		region,
	});
	const root = new AwsSystemsManager(client);
	let roles = new AwsRole(client);

	let oaa = AwsPrincipalOaaAssumeSequence({
		region,
		role,
		principal,
		root,
		roles,
	});

	if (oaa === undefined) {
		throw new VError(
			{
				name: "OAA",
				message: "OAA role assume sequence is undefined",
			},
			"OAA role assume sequence is undefined",
		);
	}

	let start = await oaa.next();
	if (start.value.$$kind !== "start") {
		throw new VError(
			{
				name: "OAA",
				message: "OAA role assume sequence did not start",
			},
			"OAA role assume sequence did not start",
		);
	}

	let roleresult = await oaa.next();
	let { account } = roleresult.value as { role: string; account?: string };
	if (roleresult.value.$$kind !== "role") {
		throw new VError(
			{
				name: "OAA",
				message: "OAA role assume sequence did not return role",
			},
			"OAA role assume sequence did not return role",
		);
	}

	let next = await oaa.next();
	if (next.value.$$kind !== "assumed") {
		throw new VError(
			{
				name: "OAA",
				message: "OAA role assume sequence did not return assumed",
			},
			"OAA role assume sequence did not return assumed",
		);
	}

	const { assumed: Credentials } = next.value;
	const assumed = new AwsClient({
		accessKeyId: Credentials.AccessKeyId,
		secretAccessKey: Credentials.SecretAccessKey,
		sessionToken: Credentials.SessionToken,
		region,
	});
	let iam = new AwsRole(assumed);
	const systems = new AwsSystemsManager(assumed);
	let parameters = AwsSystemsManagerParameterGenerator({
		root,
		systems,
	});
	await parameters.next();

	return {
		assumed,
		iam,
		parameters,
		account,
	};
};
