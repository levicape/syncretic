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
			operators: z.object({
				client: z.object({
					name: z.string(),
					clientId: z.string(),
					userPoolId: z.string(),
				}),
			}),
		}),
	})
	.passthrough();
