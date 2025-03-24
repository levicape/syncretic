import type { SessionStatus } from "oidc-client-ts";
import { useEffect } from "react";
import { useOidcClient } from "../OidcClientAtom";

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

			oidc?.userManager.signinCallback().then(async () => {
				let status: SessionStatus | null | undefined;
				let signinError: unknown;
				try {
					status = await oidc?.userManager.querySessionStatus();
				} catch (error) {
					signinError = error;
				}
				console.debug({
					AuthnCallback: {
						message: "Navigating to root after sign-in",
						status,
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

	return (
		<object
			aria-hidden
			typeof={"AuthnCallback"}
			data-oidc={oidc ? "true" : "false"}
		/>
	);
};
