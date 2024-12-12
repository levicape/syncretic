import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parse } from "ini";
import VError from "verror";

export type AWSCredentials = {
	accessKeyId: string;
	secretAccessKey: string;
	accountId?: string;
	credentialScope?: string;
	expiration?: Date;
	sessionToken?: string;
} & ({ $kind: "profile"; profile: string } | { $kind: "environment" });

export class AwsClientBuilder {
	static getAWSCredentials = async (
		profileOverride?: string,
		pathOverride?: string,
	): Promise<AWSCredentials> => {
		const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
		if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
			return {
				$kind: "environment",
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_SECRET_ACCESS_KEY,
			};
		}

		const awsCredentialsPath =
			pathOverride ||
			process.env.AWS_CREDENTIALS_PATH ||
			resolve(homedir(), "./.aws/credentials");
		const awsCredentialsProfile =
			profileOverride ||
			process.env.AWS_PROFILE ||
			process.env.AWS_DEFAULT_PROFILE ||
			"default";
		const rawData = await readFile(awsCredentialsPath, "utf8");
		const credentialsData = parse(rawData);

		if (!credentialsData || !credentialsData[awsCredentialsProfile]) {
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
			.then((rawData) => parse(rawData))
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
