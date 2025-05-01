import { useCallback, useEffect, useMemo } from "hono/jsx";
import { useAtom } from "jotai/react";
import { atom } from "jotai/vanilla";
import {
	type OidcClient,
	type User,
	UserManager,
	WebStorageStateStore,
} from "oidc-client-ts";

export type OauthClientAtomState = {
	oidcClient: OidcClient | null;
	userManager: UserManager | null;
};

export const OidcClientAtomSymbol = Symbol.for("OIDC_CLIENT_ATOM");

declare global {
	interface Window {
		"--oidc-debug"?: boolean;
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
			const debugEnabled = window["--oidc-debug"];
			if (window["~oidc_usermanager"]?.userManager) {
				if (window?.["~oidc_usermanager"]?.revalidate !== true) {
					debugEnabled &&
						console.debug({
							OidcClientAtom: {
								message: "OIDC client found in window",
								window: window["~oidc"],
							},
						});
					return window["~oidc_usermanager"];
				}
			}

			debugEnabled &&
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
				accessTokenExpiringNotificationTimeInSeconds: 66,
				stateStore: new WebStorageStateStore({
					prefix: "oidc.user.manager",
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
export type OidcFetch = typeof fetch;
export type OidcUser = User | null | undefined;

const windowFetch = fetch;
export const useOidcClient = () => {
	const [oidc] = useAtom(OidcClientAtom);
	const [user, setUser] = useAtom(OidcUserAtom);
	const { enabled: discordEnabled } = {} as Record<string, unknown>;
	const oidcFetch = useMemo(() => {
		if (user) {
			const authenticatedFetch: OidcFetch = async (
				input: Parameters<OidcFetch>[0],
				init?: Parameters<OidcFetch>[1],
			) => {
				if (oidc && user) {
					const token = user;
					if (token?.access_token) {
						return windowFetch(input, {
							...init,
							headers: {
								...(init?.headers ?? {}),
								authorization: `Bearer ${token.access_token}`,
							},
						});
					}
				}
				return windowFetch(input, init);
			};

			return authenticatedFetch;
		}

		return windowFetch;
	}, [oidc, user]);

	const fetchUserState = useCallback(() => {
		if (!discordEnabled) {
			if (user === null || user === undefined) {
				(async () => {
					const debugEnabled = window["--oidc-debug"];
					let sessionUser: User | null | undefined;
					let sessionError: unknown;
					try {
						sessionUser = await oidc?.userManager.getUser();
						setUser(sessionUser);
					} catch (error) {
						sessionError = error;
					}

					debugEnabled &&
						console.debug({
							OidcClientAtom: {
								sessionUser: {
									...sessionUser,
									access_token: undefined,
									id_token: undefined,
									refresh_token: undefined,
									token_type: undefined,
								},
								sessionError,
							},
						});

					if (sessionError) {
						throw sessionError;
					}
				})().then(() => void 0);
			}
		}
	}, [oidc, discordEnabled, user, setUser]);

	const userReady = useMemo(() => {
		return (
			user?.expired === false &&
			user?.access_token !== undefined &&
			oidcFetch !== windowFetch
		);
	}, [user?.expired, user?.access_token, oidcFetch]);

	useEffect(() => {
		fetchUserState();
	}, [fetchUserState]);

	return useMemo(() => {
		return { oidc, user, userReady, oidcFetch };
	}, [oidc, user, userReady, oidcFetch]);
};
