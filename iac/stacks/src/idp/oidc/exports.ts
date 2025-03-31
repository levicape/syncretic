import { z } from "zod";

export const FourtwoIdpOidcStackrefRoot = "idp-oidc";

export const FourtwoIdpOidcStackExportsZod = z
	.object({
		fourtwo_idp_oidc_cognito: z.object({
			pool: z.object({
				arn: z.string(),
				identityPoolName: z.string(),
				id: z.string(),
				supportedLoginProviders: z.record(z.unknown()).nullish(),
				cognitoIdentityProviders: z.array(z.unknown()).nullish(),
				developerProviderName: z.string().nullish(),
				openidConnectProviderArns: z.array(z.string()).nullish(),
				samlProviderArns: z.array(z.string()).nullish(),
			}),
		}),
	})
	.passthrough();
