import { z } from "zod";

export const FourtwoIdentityOidcStackrefRoot = "identity-oidc";

export const FourtwoIdentityOidcStackExportsZod = z
	.object({
		fourtwo_identity_oidc_cognito: z.object({
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
