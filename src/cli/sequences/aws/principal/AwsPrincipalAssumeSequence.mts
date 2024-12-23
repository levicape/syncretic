import { AwsClient } from "aws4fetch";
import VError from "verror";
import { AwsClientBuilder } from "../../../../sdk/aws/AwsClientBuilder.mjs";
import { AwsRole } from "../../../../sdk/aws/clients/AwsRole.mjs";
import { AwsSystemsManager } from "../../../../sdk/aws/clients/AwsSystemsManager.mjs";
import { AwsSystemsManagerParameterGenerator } from "../../../../sdk/aws/generators/AwsSystemsManagerParameterGenerator.mjs";

export async function* AwsPrincipalAssumeSequence({
	region,
	role,
	principal,
	root,
	roles,
	help,
}: {
	region: string;
	role: { parameter: (principal?: string) => string };
	principal: string;
	root: AwsSystemsManager;
	roles: AwsRole;
	help?: {
		resolution: string;
		reminder: string;
	};
}) {
	yield { $$kind: "start" } as const;

	let parameters = AwsSystemsManagerParameterGenerator({
		root,
	});
	await parameters.next();

	let roleParameter = (
		await parameters.next({
			template: role.parameter,
			principal,
		})
	).value;

	if (roleParameter.$$kind !== "loaded") {
		throw new VError(
			{
				name: "INVALID_STATE",
			},
			`Role parameter could not be loaded. ${JSON.stringify(
				{
					roleParameter,
					named: role.parameter(principal),
				},
				null,
				2,
			)}`,
		);
	}

	console.dir(
		{
			AwsPrincipalRoleAssumeSequence: {
				message: "Role parameter loaded",
				roleParameter,
			},
		},
		{ depth: null },
	);

	if (roleParameter?.parameter.root.value === undefined) {
		throw new VError(
			{
				name: "ROLE_PARAMETER_NOT_FOUND",
				info: {
					"Expected parameter": `${role.parameter(principal)}.`,
					Resolution: help?.resolution,
					Principal: principal,
					Reminder: help?.reminder,
				},
			},
			`Role not found. \n Expected parameter: ${role.parameter(principal)}.\n${help?.resolution ?? ""}\n${help?.reminder}.`,
		);
	}
	const serviceRole = roleParameter?.parameter.root.value?.Parameter.Value;
	const account = serviceRole.split(":")[4];

	yield {
		$$kind: "role",
		role: serviceRole,
		account,
	} as const;

	const { AssumedRoleUser, Credentials } = (
		await roles.AssumeRole({
			RoleArn: serviceRole,
			RoleSessionName: "FourtwoDeveloperCommand",
		})
	).AssumeRoleResult;

	console.dir(
		{
			AwsPrincipalAssumeSequence: {
				message: "Assumed role",
				AssumedRoleUser,
			},
		},
		{ depth: null },
	);

	yield {
		$$kind: "assumed",
		user: AssumedRoleUser,
		assumed: {
			AccessKeyId: Credentials.AccessKeyId,
			SecretAccessKey: Credentials.SecretAccessKey,
			SessionToken: Credentials.SessionToken,
			region,
		},
	} as const;

	return { $$kind: "done" } as const;
}

export const RunAwsPrincipalAssumeSequence = async ({
	principal,
	region,
	role,
	help,
}: {
	principal: string;
	region: string;
	role: { parameter: (principal?: string) => string };
	help: Parameters<typeof AwsPrincipalAssumeSequence>[0]["help"];
}) => {
	const credentials = await AwsClientBuilder.getAWSCredentials();
	const client = new AwsClient({
		...credentials,
		region,
	});
	const root = new AwsSystemsManager(client);
	let roles = new AwsRole(client);

	let oaa = AwsPrincipalAssumeSequence({
		region,
		role,
		principal,
		root,
		roles,
		help,
	});

	if (oaa === undefined) {
		throw new VError(
			{
				name: "INVALID_STATE",
			},
			"Role assume sequence is undefined",
		);
	}

	let start = await oaa.next();
	if (start.value.$$kind !== "start") {
		throw new VError(
			{
				name: "INVALID_STATE",
				info: {
					start,
				},
			},
			"Role assume sequence did not start",
		);
	}

	let roleresult = await oaa.next();
	let { account } = roleresult.value as { role: string; account?: string };
	if (roleresult.value.$$kind !== "role") {
		throw new VError(
			{
				name: "INVALID_STATE",
				info: {
					roleresult,
				},
			},
			"Role assume sequence did not return role",
		);
	}

	let next = await oaa.next();
	if (next.value.$$kind !== "assumed") {
		throw new VError(
			{
				name: "INVALID_STATE",
				info: {
					next,
				},
			},
			"Role assume sequence did not return assumed",
		);
	}

	const { assumed: Credentials, user } = next.value;
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
		user,
	};
};
