import { z } from "zod";

export const FourtwoCognitoStackExportsZod = z
	.object({
		fourtwo_cognito_identity_pool: z.object({
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
