import { z } from "zod";

export const FourtwoPanelClientOauthRoutes = {
	callback: "~oidc/callback",
	renew: "~oidc/renew",
	logout: "~oidc/logout",
} as const;

export const FourtwoPanelClientStackrefRoot = "panel-client";

export const FourtwoPanelClientStackExportsZod = z
	.object({
		fourtwo_panel_client_cognito: z.object({
			operations: z.object({
				client: z.object({
					name: z.string(),
					clientId: z.string(),
					userPoolId: z.string(),
				}),
				domain: z
					.object({
						domain: z.string(),
						userPoolId: z.string(),
						version: z.string().nullish(),
						certificateArn: z.string().nullish(),
						certificateName: z.string().nullish(),
						certificateZoneId: z.string().nullish(),
						certificateZoneName: z.string().nullish(),
					})
					.nullish(),
				record: z
					.object({
						ip4: z.object({
							id: z.string(),
							name: z.string().nullish(),
							zoneId: z.string(),
							type: z.string(),
							fqdn: z.string(),
						}),
						ip6: z.object({
							id: z.string(),
							name: z.string().nullish(),
							zoneId: z.string(),
							type: z.string(),
							fqdn: z.string(),
						}),
					})
					.nullish(),
			}),
		}),
	})
	.passthrough();
