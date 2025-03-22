import { z } from "zod";

export const FourtwoIdentityUsersStackrefRoot = "identity-users";

export const FourtwoIdentityUsersStackExportsZod = z
	.object({
		fourtwo_identity_users_cognito: z.object({
			chat: z.object({
				pool: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
					userPoolTier: z.string(),
				}),
			}),
			operations: z.object({
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
