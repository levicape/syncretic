import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parse as parseIni } from "ini";
import VError from "verror";
import { z } from "zod";

import { AwsClient } from "aws4fetch";
import { env } from "std-env";
import { AwsEnvironment } from "./AwsEnvironment.mjs";
import { AwsSso } from "./clients/AwsSso.mjs";
import { getSSOCredentialProvider } from "./credentials/sso/AwsSsoCredentials.mjs";

export type AWSCredentials = {
	accessKeyId: string;
	secretAccessKey: string;
	accountId?: string;
	credentialScope?: string;
	expiration?: Date;
	sessionToken?: string;
} & (
	| { $kind: "profile"; profile: string }
	| { $kind: "environment" }
	| { $kind: "ecr" }
	| { $kind: "sso" }
);

export class AwsClientBuilder {
	static containerCredentials = async () => {
		const envs = AwsEnvironment.parse(env);
		if (envs.AWS_CONTAINER_CREDENTIALS_FULL_URI) {
			const parsed = new URL(envs.AWS_CONTAINER_CREDENTIALS_FULL_URI);
			parsed.hostname = parsed.hostname.replace(/^\[(.+)\]$/, "$1");

			const credsResponse = await fetch(parsed, {
				method: "GET",
			});

			const creds = z
				.object({
					AccessKeyId: z.string(),
					SecretAccessKey: z.string(),
					Token: z.string(),
					Expiration: z.string(),
				})
				.parse(await credsResponse.json());

			return {
				$kind: "ecr",
				accessKeyId: creds.AccessKeyId,
				secretAccessKey: creds.SecretAccessKey,
				sessionToken: creds.Token,
				expiration: new Date(creds.Expiration),
			} as const;
		}

		return undefined;
	};

	static getSSOCredentials = async () => {
		const credentials = await getSSOCredentialProvider({})();
		return {
			$kind: "sso",
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
			sessionToken: credentials.sessionToken,
			expiration: credentials.expiration,
		} as AWSCredentials;
	};

	static getAWSCredentials = async (
		profileOverride?: string,
		pathOverride?: string,
	): Promise<AWSCredentials> => {
		const awsCredentialsPath =
			pathOverride ||
			env.AWS_CREDENTIALS_PATH ||
			resolve(homedir(), "./.aws/credentials");
		const awsCredentialsProfile =
			profileOverride ||
			env.AWS_PROFILE ||
			env.AWS_DEFAULT_PROFILE ||
			"default";

		// Process Resolver
		const {
			AWS_ACCESS_KEY_ID,
			AWS_EXECUTION_ENV,
			AWS_SECRET_ACCESS_KEY,
			AWS_SESSION_TOKEN,
		} = env;

		if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
			return {
				$kind: "environment",
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_SECRET_ACCESS_KEY,
				sessionToken: AWS_SESSION_TOKEN,
			};
		}

		if (AWS_EXECUTION_ENV !== undefined) {
			// Container Resolver
			const containerCredentials =
				await AwsClientBuilder.containerCredentials();

			if (containerCredentials) {
				return containerCredentials;
			}
		}
		const rawData = await readFile(awsCredentialsPath, "utf8");
		const credentialsData = parseIni(rawData);

		if (!credentialsData || !credentialsData[awsCredentialsProfile]) {
			// SSO Resolver
			const ssoCredentials = await AwsClientBuilder.getSSOCredentials();
			if (ssoCredentials) {
				return ssoCredentials;
			}

			throw new VError(
				`Failed getting credentials: No profile found for profile: ${awsCredentialsProfile}. 
				Available profiles: ${Object.keys(credentialsData).join(", ")}`,
			);
		}

		const { aws_access_key_id: accessKey, aws_secret_access_key: secretKey } =
			credentialsData[awsCredentialsProfile];

		if (typeof accessKey !== "string") {
			throw new VError(
				`Failed getting credentials: No access key ID for profile: ${awsCredentialsProfile}`,
			);
		}
		if (typeof secretKey !== "string") {
			throw new VError(
				`Failed getting credentials: No secret access key for profile: ${awsCredentialsProfile}`,
			);
		}
		return {
			$kind: "profile",
			accessKeyId: accessKey,
			secretAccessKey: secretKey,
			profile: awsCredentialsProfile,
		};
	};

	static getAWSProfiles = async (pathOverride?: string) => {
		const awsCredentialsPath =
			pathOverride ||
			process.env.AWS_CREDENTIALS_PATH ||
			resolve(homedir(), "./.aws/credentials");
		return readFile(awsCredentialsPath, "utf8")
			.then((rawData) => parseIni(rawData))
			.then((credentials) =>
				credentials && typeof credentials === "object"
					? Object.keys(credentials)
					: [],
			)
			.catch((err) => {
				throw new VError(err, "Failed getting profiles");
			});
	};
}
