import type { User } from "oidc-client-ts";
import { useEffect, useMemo, useState } from "react";
import { useOidcClient } from "../OidcClientAtom";

export const AuthnSession = () => {
	const [oidc] = useOidcClient();
	const [sessionUser, setSessionUser] = useState<User | null | undefined>(null);
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	useEffect(() => {
		if (!discordEnabled) {
			(async () => {
				let sessionUser: User | null | undefined;
				let sessionError: unknown;
				console.debug({
					AuthnSession: {
						message: "Fetching session user",
					},
				});
				try {
					sessionUser = await oidc?.userManager.getUser();
					setSessionUser(sessionUser);
				} catch (error) {
					sessionError = error;
				}
				console.debug({
					AuthnSession: {
						sessionUser,
						sessionError,
					},
				});
			})().then(() => void 0);
		}
	}, [oidc, discordEnabled]);

	const style: React.CSSProperties = useMemo(
		() => ({
			display: "none",
			pointerEvents: "none",
			touchAction: "none",
			position: "fixed",
			visibility: "hidden",
			width: 0,
			height: 0,
			top: 0,
			left: 0,
			zIndex: -1,
		}),
		[],
	);

	const dataAttributes = useMemo(
		() => ({
			"data-oidc": oidc !== null ? "true" : "false",
			"data-session-expired": sessionUser?.expired
				? JSON.stringify(sessionUser.expired)
				: "",
			"data-session-expires-at": sessionUser?.expires_at
				? JSON.stringify(sessionUser?.expires_at)
				: "",
			"data-session-expires-in": sessionUser?.expires_in
				? JSON.stringify(sessionUser.expires_in)
				: "",
			"data-session-scopes": sessionUser?.scopes
				? JSON.stringify(sessionUser.scopes)
				: "",
			"data-session-profile": sessionUser?.profile
				? JSON.stringify(sessionUser.profile)
				: "",
			"data-session-state": sessionUser?.state
				? JSON.stringify(sessionUser.state)
				: "",
			"data-session-token-type": sessionUser?.token_type
				? JSON.stringify(sessionUser.token_type)
				: "",
		}),
		[oidc, sessionUser],
	);

	return (
		<object
			aria-hidden
			style={style}
			typeof={"AuthnSession"}
			{...dataAttributes}
		/>
	);
};
