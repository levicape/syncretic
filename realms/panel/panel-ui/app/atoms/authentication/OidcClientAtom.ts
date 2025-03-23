import { useAtom } from "jotai/react";
import { atom } from "jotai/vanilla";
import { OidcClient, UserManager } from "oidc-client-ts";

export type OauthClientAtomState = {
	oidcClient: OidcClient | null;
	userManager: UserManager | null;
};

export const OidcClientAtomSymbol = Symbol.for("OIDC_CLIENT_ATOM");

declare global {
	interface Window {
		"~oidc":
			| {
					OAUTH_PUBLIC_OIDC_AUTHORITY: string;
					OAUTH_PUBLIC_OIDC_CLIENT_ID: string;
					OAUTH_PUBLIC_OIDC_REDIRECT_URI: string;
					OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI: string;
					OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI: string;
			  }
			| undefined;
		"~oidc_usermanager":
			| {
					revalidate: boolean;
					oidcClient: OidcClient;
					userManager: UserManager;
			  }
			| undefined;
	}
}

const initializeOidcClient = () => {
	if (typeof window !== "undefined") {
		if (window["~oidc"]) {
			if (window["~oidc_usermanager"]) {
				if (window?.["~oidc_usermanager"]?.revalidate !== true) {
					return window["~oidc_usermanager"];
				}
			}

			console.debug({
				OidcClientAtom: {
					message: "OIDC client initializing",
					window: window["~oidc"],
				},
			});
			const {
				OAUTH_PUBLIC_OIDC_AUTHORITY,
				OAUTH_PUBLIC_OIDC_CLIENT_ID,
				OAUTH_PUBLIC_OIDC_REDIRECT_URI,
				OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI,
				OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI,
			} = window["~oidc"];
			const oidcClient = new OidcClient({
				authority: OAUTH_PUBLIC_OIDC_AUTHORITY ?? "",
				client_id: OAUTH_PUBLIC_OIDC_CLIENT_ID ?? "",
				redirect_uri: OAUTH_PUBLIC_OIDC_REDIRECT_URI ?? "",
				post_logout_redirect_uri:
					OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI ?? "",
				response_type: "code",
				scope: "openid profile email",
			});

			const userManager = new UserManager({
				authority: OAUTH_PUBLIC_OIDC_AUTHORITY ?? "",
				client_id: OAUTH_PUBLIC_OIDC_CLIENT_ID ?? "",
				redirect_uri: OAUTH_PUBLIC_OIDC_REDIRECT_URI ?? "",
				post_logout_redirect_uri:
					OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI ?? "",
				silent_redirect_uri: OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI ?? "",
				response_type: "code",
				scope: "openid profile email",
				automaticSilentRenew: true,
			});

			const windowObj = {
				oidcClient,
				userManager,
				revalidate: false,
			};
			if (typeof window !== "undefined") {
				window["~oidc_usermanager"] = windowObj;
			}

			return windowObj;
		}
	} else {
		console.warn({
			OidcClientAtom: {
				message: "OIDC client not initialized",
			},
		});
	}
	return null;
};

export const OidcClientAtom = atom(initializeOidcClient());

export const useOidcClient = () => {
	const [state] = useAtom(OidcClientAtom);
	return [state] as const;
};
