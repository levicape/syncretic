import { z } from "zod";

export const FourtwoCognitoUsersStackExportsZod = z
	.object({
		fourtwo_cognito_users_userpool: z.object({
			chat: z.object({
				pool: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
					userPoolTier: z.string(),
				}),
			}),
			moderation: z.object({
				pool: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
					userPoolTier: z.string(),
				}),
			}),
		}),
	})
	.passthrough();
