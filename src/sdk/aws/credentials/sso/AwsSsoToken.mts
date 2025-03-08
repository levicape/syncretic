import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
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
import type { AwsClient } from "aws4fetch";
import { process } from "std-env";
import VError from "verror";
import type {
	AwsCredentialIdentity,
	AwsCredentialIdentityProvider,
	Identity,
	IdentityProvider,
} from "../AwsIdentity.mjs";
import { getProfileName } from "../AwsProfile.mjs";
import {
	type CredentialProviderOptions,
	type SourceProfileInit,
	parseKnownFiles,
} from "./AwsSsoCredentials.mjs";
import { getNewSsoOidcToken } from "./AwsSsoOidc.mjs";
import { loadSsoSessionData } from "./AwsSsoSession.mjs";

/**
 * @public
 * Values from ALPN Protocol IDs.
 * @see https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids
 */
export enum RequestHandlerProtocol {
	HTTP_0_9 = "http/0.9",
	HTTP_1_0 = "http/1.0",
	TDS_8_0 = "tds/8.0",
}

/**
 * Cached SSO token retrieved from SSO login flow.
 * @public
 */
export interface SSOToken {
	/**
	 * A base64 encoded string returned by the sso-oidc service.
	 */
	accessToken: string;

	/**
	 * The expiration time of the accessToken as an RFC 3339 formatted timestamp.
	 */
	expiresAt: string;

	/**
	 * The token used to obtain an access token in the event that the accessToken is invalid or expired.
	 */
	refreshToken?: string;

	/**
	 * The unique identifier string for each client. The client ID generated when performing the registration
	 * portion of the OIDC authorization flow. This is used to refresh the accessToken.
	 */
	clientId?: string;

	/**
	 * A secret string generated when performing the registration portion of the OIDC authorization flow.
	 * This is used to refresh the accessToken.
	 */
	clientSecret?: string;

	/**
	 * The expiration time of the client registration (clientId and clientSecret) as an RFC 3339 formatted timestamp.
	 */
	registrationExpiresAt?: string;

	/**
	 * The configured sso_region for the profile that credentials are being resolved for.
	 */
	region?: string;

	/**
	 * The configured sso_start_url for the profile that credentials are being resolved for.
	 */
	startUrl?: string;
}

/**
 * @public
 */
export type RequestHandlerOutput<ResponseType> = { response: ResponseType };

/**
 * @public
 */
export interface RequestHandler<
	RequestType,
	ResponseType,
	HandlerOptions = {},
> {
	/**
	 * metadata contains information of a handler. For example
	 * 'h2' refers this handler is for handling HTTP/2 requests,
	 * whereas 'h1' refers handling HTTP1 requests
	 */
	metadata?: RequestHandlerMetadata;
	destroy?: () => void;
	handle: (
		request: RequestType,
		handlerOptions?: HandlerOptions,
	) => Promise<RequestHandlerOutput<ResponseType>>;
}

/**
 * @public
 */
export interface RequestHandlerMetadata {
	handlerProtocol: RequestHandlerProtocol | string;
}

/**
 * @public
 */
export interface AwsIdentityProperties {
	/**
	 * These are resolved client config values, and may be async providers.
	 */
	callerClientConfig?: {
		/**
		 * It is likely a programming error if you use
		 * the caller client config credentials in a credential provider, since
		 * it will recurse.
		 *
		 * @deprecated do not use.
		 */
		credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
		/**
		 * @internal
		 * @deprecated minimize use.
		 */
		credentialDefaultProvider?: (
			input?: unknown,
		) => AwsCredentialIdentityProvider;
		profile?: string;
		region(): Promise<string>;
		requestHandler?: RequestHandler<unknown, unknown>;
	};
}

/**
 * @public
 *
 * Variation of {@link IdentityProvider} which accepts a contextual
 * client configuration that includes an AWS region and potentially other
 * configurable fields.
 *
 * Used to link a credential provider to a client if it is being called
 * in the context of a client.
 */
export type RuntimeConfigIdentityProvider<T> = (
	awsIdentityProperties?: AwsIdentityProperties,
) => Promise<T>;

/**
 * @public
 *
 * Variation of {@link AwsCredentialIdentityProvider} which accepts a contextual
 * client configuration that includes an AWS region and potentially other
 * configurable fields.
 *
 * Used to link a credential provider to a client if it is being called
 * in the context of a client.
 */
export type RuntimeConfigAwsCredentialIdentityProvider =
	RuntimeConfigIdentityProvider<AwsCredentialIdentity>;

export interface FromSsoInit
	extends SourceProfileInit,
		CredentialProviderOptions {
	/**
	 * @see SSOOIDCClientConfig in \@aws-sdk/client-sso-oidc.
	 */
	clientConfig?: ConstructorParameters<typeof AwsClient>[0];
}

/**
 * @internal
 */
export interface TokenIdentity extends Identity {
	/**
	 * The literal token string
	 */
	readonly token: string;
}

/**
 * @internal
 */
export type TokenIdentityProvider = IdentityProvider<TokenIdentity>;

/**
 * Last refresh attempt time to ensure refresh is not attempted more than once every 30 seconds.
 */
const lastRefreshAttemptTime = new Date(0);

const homeDirCache: Record<string, string> = {};

const getHomeDirCacheKey = (): string => {
	// geteuid is only available on POSIX platforms (i.e. not Windows or Android).
	if (process?.geteuid) {
		return `${process.geteuid?.()}`;
	}
	return "DEFAULT";
};

/**
 * Get the HOME directory for the current runtime.
 *
 * @internal
 */
export const getHomeDir = (): string => {
	const { HOME, USERPROFILE, HOMEPATH, HOMEDRIVE = `C:${sep}` } = process.env;

	if (HOME) return HOME;
	if (USERPROFILE) return USERPROFILE;
	if (HOMEPATH) return `${HOMEDRIVE}${HOMEPATH}`;

	const homeDirCacheKey = getHomeDirCacheKey();
	if (!homeDirCache[homeDirCacheKey]) homeDirCache[homeDirCacheKey] = homedir();

	return homeDirCache[homeDirCacheKey];
};

/**
 * Returns the filepath of the file where SSO token is stored.
 * @internal
 */
export const getSSOTokenFilepath = (id: string) => {
	const hasher = createHash("sha1");
	const cacheName = hasher.update(id).digest("hex");
	return join(getHomeDir(), ".aws", "sso", "cache", `${cacheName}.json`);
};

/**
 * @internal
 * @param id - can be either a start URL or the SSO session name.
 * Returns the SSO token from the file system.
 */
export const getSSOTokenFromFile = async (id: string) => {
	const ssoTokenFilepath = getSSOTokenFilepath(id);
	const ssoTokenText = await readFile(ssoTokenFilepath, "utf8");
	return JSON.parse(ssoTokenText) as SSOToken;
};

/**
 * The time window (5 mins) that SDK will treat the SSO token expires in before the defined expiration date in token.
 * This is needed because server side may have invalidated the token before the defined expiration date.
 *
 * @internal
 */
export const EXPIRE_WINDOW_MS = 5 * 60 * 1000;

export const REFRESH_MESSAGE = `To refresh this SSO session run 'aws sso login' with the corresponding profile.`;

/**
 * Throws TokenProviderError is token is expired.
 */
export const validateTokenExpiry = (token: TokenIdentity) => {
	if (token.expiration && token.expiration.getTime() < Date.now()) {
		throw new VError(`Token is expired. ${REFRESH_MESSAGE}`);
	}
};

/**
 * Throws TokenProviderError if value is undefined for key.
 */
export const validateTokenKey = (
	key: string,
	value: unknown,
	forRefresh = false,
) => {
	if (typeof value === "undefined") {
		throw new VError(
			`Value not present for '${key}' in SSO Token${forRefresh ? ". Cannot refresh" : ""}. ${REFRESH_MESSAGE}`,
		);
	}
};

/**
 * Writes SSO token to file based on filepath computed from ssoStartUrl or session name.
 */
export const writeSSOTokenToFile = (id: string, ssoToken: SSOToken) => {
	const tokenFilepath = getSSOTokenFilepath(id);
	const tokenString = JSON.stringify(ssoToken, null, 2);
	return writeFile(tokenFilepath, tokenString);
};

/**
 * Creates a token provider that will read from SSO token cache or ssoOidc.createToken() call.
 */
export const getAwsSsoTokenProvider =
	(_init: FromSsoInit = {}): RuntimeConfigIdentityProvider<TokenIdentity> =>
	async ({ callerClientConfig } = {}) => {
		const init: FromSsoInit = {
			..._init,
			parentClientConfig: {
				...callerClientConfig,
				..._init.parentClientConfig,
			},
		};

		const profiles = await parseKnownFiles(init);
		const profileName = getProfileName({
			profile: init.profile ?? callerClientConfig?.profile,
		});
		const profile = profiles[profileName];

		if (!profile) {
			// Profile not found. This is a terminal error.
			throw new VError(
				`Profile '${profileName}' could not be found in shared credentials file.`,
			);
		}

		if (!profile["sso_session"]) {
			// Profile found but it does not contain sso_session. Not a terminal error.
			throw new VError(
				`Profile '${profileName}' is missing required property 'sso_session'.`,
			);
		}

		// read sso-session from config file.
		const ssoSessionName = profile["sso_session"];
		const ssoSessions = await loadSsoSessionData(init);
		const ssoSession = ssoSessions[ssoSessionName];

		if (!ssoSession) {
			// Sso Session not found. This is a terminal error.
			throw new VError(
				`Sso session '${ssoSessionName}' could not be found in shared credentials file.`,
			);
		}

		for (const ssoSessionRequiredKey of ["sso_start_url", "sso_region"]) {
			if (!ssoSession[ssoSessionRequiredKey]) {
				// Sso session found but it does not contain ssoSessionRequiredKey. This is a terminal error.
				throw new VError(
					`Sso session '${ssoSessionName}' is missing required property '${ssoSessionRequiredKey}'.`,
				);
			}
		}

		const ssoStartUrl = ssoSession["sso_start_url"] as string;
		const ssoRegion = ssoSession["sso_region"] as string;

		let ssoToken: SSOToken;
		try {
			ssoToken = await getSSOTokenFromFile(ssoSessionName);
		} catch (e) {
			throw new VError(
				`The SSO session token associated with profile=${profileName} was not found or is invalid. ${REFRESH_MESSAGE}`,
			);
		}

		validateTokenKey("accessToken", ssoToken.accessToken);
		validateTokenKey("expiresAt", ssoToken.expiresAt);

		const { accessToken, expiresAt } = ssoToken;
		const existingToken: TokenIdentity = {
			token: accessToken,
			expiration: new Date(expiresAt),
		};
		if (existingToken.expiration!.getTime() - Date.now() > EXPIRE_WINDOW_MS) {
			// Token is valid and not expired.
			return existingToken;
		}

		// Skip new refresh, if last refresh was done within 30 seconds.
		if (Date.now() - lastRefreshAttemptTime.getTime() < 30 * 1000) {
			/// return existing token if it's still valid.
			validateTokenExpiry(existingToken);
			return existingToken;
		}

		validateTokenKey("clientId", ssoToken.clientId, true);
		validateTokenKey("clientSecret", ssoToken.clientSecret, true);
		validateTokenKey("refreshToken", ssoToken.refreshToken, true);

		try {
			lastRefreshAttemptTime.setTime(Date.now());
			const newSsoOidcToken = await getNewSsoOidcToken(
				ssoToken,
				ssoRegion,
				init,
			);
			validateTokenKey("accessToken", newSsoOidcToken.access_token);
			validateTokenKey("expiresIn", newSsoOidcToken.expires_in);
			const newTokenExpiration = new Date(
				Date.now() + newSsoOidcToken.expires_in * 1000,
			);

			try {
				await writeSSOTokenToFile(ssoSessionName, {
					...ssoToken,
					accessToken: newSsoOidcToken.access_token,
					expiresAt: newTokenExpiration.toISOString(),
					refreshToken: newSsoOidcToken.refresh_token,
				});
			} catch (error) {
				// Swallow error if unable to write token to file.
			}

			return {
				token: newSsoOidcToken.access_token,
				expiration: newTokenExpiration,
			};
		} catch (error) {
			// return existing token if it's still valid.
			validateTokenExpiry(existingToken);
			return existingToken;
		}
	};
