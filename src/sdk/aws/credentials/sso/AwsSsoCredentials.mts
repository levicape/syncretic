/*

   Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   Author notes:
   This file reinterprets source code from the AWS SDK for JavaScript v3 to be compatible with this codebase.
   The logic is the same, but organization, formatting, and some variables have been changed.
   Particularly, some types from @smithy have been replaced with inline types, and exceptions are all now VErrors.
   The original source code is available at https://github.com/aws/aws-sdk-js-v3/tree/main/packages/credential-provider-sso

   API Version: 2024-01-16
*/
import { AwsClient } from "aws4fetch";
import { deserializeError } from "serialize-error";
import VError from "verror";
import { AwsSso } from "../../clients/AwsSso.mjs";
import type { AwsCredentialIdentity } from "../AwsIdentity.mjs";
import { getProfileName } from "../AwsProfile.mjs";
import type { AwsSsoClientConfig } from "./AwsSsoClient.mjs";
import { loadSharedConfigFiles, mergeConfigFiles } from "./AwsSsoConfig.mjs";
import { loadSsoSessionData } from "./AwsSsoSession.mjs";
import type { RuntimeConfigAwsCredentialIdentityProvider } from "./AwsSsoToken.mjs";
import {
	type SSOToken,
	getAwsSsoTokenProvider,
	getSSOTokenFromFile,
} from "./AwsSsoToken.mjs";

/**
 * @public
 *
 * A function that, when invoked, returns a promise that will be fulfilled with
 * a value of type T.
 *
 * @example A function that reads credentials from shared SDK configuration
 * files, assuming roles and collecting MFA tokens as necessary.
 */
export type Provider<T> = () => Promise<T>;

/**
 * @public
 *
 * An object representing temporary or permanent AWS credentials.
 *
 * @deprecated Use {@link AwsCredentialIdentity}
 */
export interface Credentials extends AwsCredentialIdentity {}

/**
 * @public
 *
 * @deprecated Use {@link AwsCredentialIdentityProvider}
 */
export type CredentialProvider = Provider<Credentials>;

/**
 * @public
 *
 * Common options for credential providers.
 */
export type CredentialProviderOptions = {
	/**
	 * Present if the credential provider was created by calling
	 * the defaultCredentialProvider in a client's middleware, having
	 * access to the client's config.
	 *
	 * The region of that parent or outer client is important because
	 * an inner client used by the credential provider may need
	 * to match its default partition or region with that of
	 * the outer client.
	 *
	 * @internal
	 * @deprecated - not truly deprecated, marked as a warning to not use this.
	 */
	parentClientConfig?: {
		region?: string | Provider<string>;
		profile?: string;
		[key: string]: unknown;
	};
};

/**
 * @public
 */
export type IniSection = Record<string, string | undefined>;

/**
 * @public
 *
 * @deprecated Please use {@link IniSection}
 */
export interface Profile extends IniSection {}

/**
 * @public
 */
export type ParsedIniData = Record<string, IniSection>;

/**
 * @public
 */
export interface SharedConfigFiles {
	credentialsFile: ParsedIniData;
	configFile: ParsedIniData;
}

/**
 * @internal
 */
export interface SsoProfile extends Profile {
	sso_start_url: string;
	sso_session?: string;
	sso_account_id: string;
	sso_region: string;
	sso_role_name: string;
}

export const isSsoProfile = (arg: Profile): arg is Partial<SsoProfile> =>
	arg &&
	(typeof arg.sso_start_url === "string" ||
		typeof arg.sso_account_id === "string" ||
		typeof arg.sso_session === "string" ||
		typeof arg.sso_region === "string" ||
		typeof arg.sso_role_name === "string");

/**
 * @public
 */
export interface SharedConfigInit {
	/**
	 * The path at which to locate the ini credentials file. Defaults to the
	 * value of the `AWS_SHARED_CREDENTIALS_FILE` environment variable (if
	 * defined) or `~/.aws/credentials` otherwise.
	 */
	filepath?: string;

	/**
	 * The path at which to locate the ini config file. Defaults to the value of
	 * the `AWS_CONFIG_FILE` environment variable (if defined) or
	 * `~/.aws/config` otherwise.
	 */
	configFilepath?: string;

	/**
	 * Configuration files are normally cached after the first time they are loaded. When this
	 * property is set, the provider will always reload any configuration files loaded before.
	 */
	ignoreCache?: boolean;
}

/**
 * @internal
 */
export interface SsoCredentialsParameters {
	/**
	 * The URL to the AWS SSO service.
	 */
	ssoStartUrl: string;

	/**
	 * SSO session identifier.
	 * Presence implies usage of the SSOTokenProvider.
	 */
	ssoSession?: string;

	/**
	 * The ID of the AWS account to use for temporary credentials.
	 */
	ssoAccountId: string;

	/**
	 * The AWS region to use for temporary credentials.
	 */
	ssoRegion: string;

	/**
	 * The name of the AWS role to assume.
	 */
	ssoRoleName: string;
}

/**
 * @public
 */
export interface SourceProfileInit extends SharedConfigInit {
	/**
	 * The configuration profile to use.
	 */
	profile?: string;
}

/**
 * @internal
 */
export interface FromSSOInit
	extends SourceProfileInit,
		CredentialProviderOptions {
	ssoClient?: AwsSso;
	clientConfig?: AwsSsoClientConfig;
}

/**
 * Load profiles from credentials and config INI files and normalize them into a
 * single profile list.
 *
 * @internal
 */
export const parseKnownFiles = async (
	init: SourceProfileInit,
): Promise<ParsedIniData> => {
	const parsedFiles = await loadSharedConfigFiles(init);
	return mergeConfigFiles(parsedFiles.configFile, parsedFiles.credentialsFile);
};
/**
 * @internal
 *
 * Creates a credential provider that will read from a credential_process specified
 * in ini files.
 *
 * The SSO credential provider must support both
 *
 * 1. the legacy profile format,
 * @example
 * ```
 * [profile sample-profile]
 * sso_account_id = 012345678901
 * sso_region = us-east-1
 * sso_role_name = SampleRole
 * sso_start_url = https://www.....com/start
 * ```
 *
 * 2. and the profile format for SSO Token Providers.
 * @example
 * ```
 * [profile sso-profile]
 * sso_session = dev
 * sso_account_id = 012345678901
 * sso_role_name = SampleRole
 *
 * [sso-session dev]
 * sso_region = us-east-1
 * sso_start_url = https://www.....com/start
 * ```
 */
export const getSSOCredentialProvider =
	(
		init: FromSSOInit & Partial<SsoCredentialsParameters> = {},
	): RuntimeConfigAwsCredentialIdentityProvider =>
	async ({ callerClientConfig } = {}) => {
		const { ssoStartUrl, ssoAccountId, ssoRegion, ssoRoleName, ssoSession } =
			init;
		const { ssoClient } = init;
		const profileName = getProfileName({
			profile: init.profile ?? callerClientConfig?.profile,
		});

		if (
			!ssoStartUrl &&
			!ssoAccountId &&
			!ssoRegion &&
			!ssoRoleName &&
			!ssoSession
		) {
			// Load the SSO config from shared AWS config file.
			const profiles = await parseKnownFiles(init);
			const profile = profiles[profileName];

			if (!profile) {
				throw new VError(`Profile ${profileName} was not found.`);
			}

			if (!isSsoProfile(profile)) {
				throw new VError(
					`Profile ${profileName} is not configured with SSO credentials.`,
				);
			}

			if (profile?.sso_session) {
				const ssoSessions = await loadSsoSessionData(init);
				const session = ssoSessions[profile.sso_session];
				const conflictMsg = ` configurations in profile ${profileName} and sso-session ${profile.sso_session}`;
				if (ssoRegion && ssoRegion !== session.sso_region) {
					throw new VError(`Conflicting SSO region ${conflictMsg}`);
				}
				if (ssoStartUrl && ssoStartUrl !== session.sso_start_url) {
					throw new VError(`Conflicting SSO start_url ${conflictMsg}`);
				}
				profile.sso_region = session.sso_region;
				profile.sso_start_url = session.sso_start_url;
			}

			const {
				sso_start_url,
				sso_account_id,
				sso_region,
				sso_role_name,
				sso_session,
			} = validateSsoProfile(profile);
			return resolveSSOCredentials({
				ssoStartUrl: sso_start_url,
				ssoSession: sso_session,
				ssoAccountId: sso_account_id,
				ssoRegion: sso_region,
				ssoRoleName: sso_role_name,
				ssoClient: ssoClient,
				clientConfig: init.clientConfig,
				parentClientConfig: init.parentClientConfig,
				profile: profileName,
			});
		}

		if (!ssoStartUrl || !ssoAccountId || !ssoRegion || !ssoRoleName) {
			throw new VError(
				"Incomplete configuration. The fromSSO() argument hash must include " +
					'"ssoStartUrl", "ssoAccountId", "ssoRegion", "ssoRoleName"',
			);
		}

		return resolveSSOCredentials({
			ssoStartUrl,
			ssoSession,
			ssoAccountId,
			ssoRegion,
			ssoRoleName,
			ssoClient,
			clientConfig: init.clientConfig,
			parentClientConfig: init.parentClientConfig,
			profile: profileName,
		});
	};

/**
 * @internal
 */
export const validateSsoProfile = (
	profile: Partial<SsoProfile>,
): SsoProfile => {
	const { sso_start_url, sso_account_id, sso_region, sso_role_name } = profile;
	if (!sso_start_url || !sso_account_id || !sso_region || !sso_role_name) {
		throw new VError(
			`Profile is configured with invalid SSO credentials. Required parameters "sso_account_id", "sso_region", "sso_role_name", "sso_start_url". Got ${Object.keys(
				profile,
			).join(
				", ",
			)}\nReference: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html`,
		);
	}
	return profile as SsoProfile;
};

export const resolveSSOCredentials = async ({
	ssoStartUrl,
	ssoSession,
	ssoAccountId,
	ssoRegion,
	ssoRoleName,
	ssoClient,
	clientConfig,
	parentClientConfig,
	profile,
	// logger,
}: FromSSOInit & SsoCredentialsParameters): Promise<AwsCredentialIdentity> => {
	let token: SSOToken;
	const refreshMessage = `To refresh this SSO session run aws sso login with the corresponding profile.`;

	if (ssoSession) {
		try {
			const _token = await getAwsSsoTokenProvider({ profile })();
			token = {
				accessToken: _token.token,
				expiresAt: new Date(_token.expiration!).toISOString(),
			};
		} catch (e) {
			throw new VError(deserializeError(e), refreshMessage);
		}
	} else {
		try {
			token = await getSSOTokenFromFile(ssoStartUrl);
		} catch (e) {
			throw new VError(
				`The SSO session associated with this profile is invalid. ${refreshMessage}`,
			);
		}
	}

	if (new Date(token.expiresAt).getTime() - Date.now() <= 0) {
		throw new VError(
			`The SSO session associated with this profile has expired. ${refreshMessage}`,
		);
	}

	const { accessToken } = token;

	let sso = ssoClient;
	if (sso === undefined) {
		// AccessKeyId is not required for SSO calls, authentication is done via token call
		const client = new AwsClient(
			Object.assign(
				clientConfig ?? {},
				{
					region: ssoRegion,
					accessKeyId: "",
					secretAccessKey: "",
				},
				parentClientConfig,
			) as ConstructorParameters<typeof AwsClient>[0],
		);
		sso = new AwsSso(client);
	}

	let ssoResp: Awaited<ReturnType<AwsSso["GetRoleCredentials"]>>;
	try {
		ssoResp = await sso.GetRoleCredentials({
			roleName: ssoRoleName,
			accountId: ssoAccountId,
			accessToken,
		});
	} catch (e) {
		throw new VError(deserializeError(e), "Could not get SSO credentials");
	}
	const {
		roleCredentials: {
			accessKeyId,
			secretAccessKey,
			sessionToken,
			expiration,
			credentialScope,
			accountId,
		} = {},
	} = ssoResp as unknown as {
		roleCredentials: {
			accessKeyId?: string;
			secretAccessKey?: string;
			sessionToken?: string;
			expiration?: Date | string;
			credentialScope?: string;
			accountId?: string;
		};
	};

	if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
		throw new VError("SSO returns an invalid temporary credential.");
	}

	const credentials = {
		accessKeyId,
		secretAccessKey,
		sessionToken,
		expiration: new Date(expiration),
		...(credentialScope && { credentialScope }),
		...(accountId && { accountId }),
	};

	// if (ssoSession) {
	//   setCredentialFeature(credentials, "CREDENTIALS_SSO", "s");
	// } else {
	//   setCredentialFeature(credentials, "CREDENTIALS_SSO_LEGACY", "u");
	// }

	return credentials;
};
