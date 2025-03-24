import { useAtom } from "jotai/react";
import { atom } from "jotai/vanilla";
import {
	type OidcClient,
	type User,
	UserManager,
	WebStorageStateStore,
} from "oidc-client-ts";
import { useEffect } from "react";

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
					userManager: UserManager;
			  }
			| undefined;
	}
}

const initializeOidcClient = () => {
	if (typeof window !== "undefined") {
		if (window["~oidc"]) {
			if (window["~oidc_usermanager"]?.userManager) {
				if (window?.["~oidc_usermanager"]?.revalidate !== true) {
					console.debug({
						OidcClientAtom: {
							message: "OIDC client found in window",
							window: window["~oidc"],
						},
					});
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

			const userManager = new UserManager({
				authority: OAUTH_PUBLIC_OIDC_AUTHORITY,
				client_id: OAUTH_PUBLIC_OIDC_CLIENT_ID,
				redirect_uri: OAUTH_PUBLIC_OIDC_REDIRECT_URI,
				post_logout_redirect_uri: OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI,
				silent_redirect_uri: OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI,
				response_type: "code",
				scope: "openid profile email",
				automaticSilentRenew: false,
				accessTokenExpiringNotificationTimeInSeconds: 20,
				stateStore: new WebStorageStateStore({
					prefix: "oidc-user-manager",
					store: window.localStorage,
				}),
			});

			const windowObj = {
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

const client = initializeOidcClient();
export const OidcClientAtom = atom(client);
export const OidcUserAtom = atom<User | null | undefined>(undefined);

export const useOidcClient = () => {
	const [oidc] = useAtom(OidcClientAtom);
	const [user, setUser] = useAtom(OidcUserAtom);

	useEffect(() => {
		if (oidc?.userManager) {
			oidc.userManager.getUser().then(setUser);
		}
	}, [oidc, setUser]);

	return [oidc, user] as const;
};
