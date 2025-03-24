import { useEffect, useMemo } from "react";
import { useOidcClient } from "../../../atoms/authentication/OidcClientAtom";

export const AuthnCallback = () => {
	const [oidc] = useOidcClient();
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	useEffect(() => {
		if (!discordEnabled) {
			console.debug({
				AuthnCallback: {
					message: "Processing auth callback",
				},
			});

			oidc?.userManager.signinCallback().then(async (status) => {
				let signinError: unknown;
				console.debug({
					AuthnCallback: {
						message: "Navigating to root after sign-in",
						status: {
							sessionState: status?.session_state,
							state: status?.state,
						},
						signinError,
					},
				});
				setTimeout(
					() => {
						location.assign("/");
					},
					Math.random() * 100 + 20,
				);
			});
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

	return (
		<object
			aria-hidden
			typeof={"AuthnCallback"}
			data-oidc={oidc ? "true" : "false"}
			style={style}
			suppressHydrationWarning
		/>
	);
};
