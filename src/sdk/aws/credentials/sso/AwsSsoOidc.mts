import { AwsClient } from "aws4fetch";
import VError from "verror";
import { AwsOIDC } from "../../clients/AwsOIDC.mjs";
import type { FromSsoInit, SSOToken } from "./AwsSsoToken.mjs";

/**
 * Returns a SSOOIDC client for the given region.
 * @internal
 */
export const getSsoOidcClient = async (
	ssoRegion: string,
	init: FromSsoInit = {},
) => {
	if (init.clientConfig) {
		init.clientConfig.region ??= ssoRegion;
		init.clientConfig.accessKeyId ??= "";
		init.clientConfig.secretAccessKey ??= "";
		const ssoOidcClient = new AwsClient(init.clientConfig!);
		return new AwsOIDC(ssoOidcClient);
	}

	throw new VError(
		"SSO OIDC client is not configured. Please provide a valid clientConfig.",
	);
};

/**
 * Returns a new SSO OIDC token from ssoOids.createToken() API call.
 * @internal
 */
export const getNewSsoOidcToken = async (
	ssoToken: SSOToken,
	ssoRegion: string,
	init: FromSsoInit = {},
) => {
	const ssoOidcClient = await getSsoOidcClient(ssoRegion, init);
	return await ssoOidcClient.CreateToken({
		clientId: ssoToken.clientId ?? "",
		clientSecret: ssoToken.clientSecret ?? "",
		refreshToken: ssoToken.refreshToken ?? "",
		grantType: "refresh_token",
	});
};
