import type { SessionStatus } from "oidc-client-ts";
import { useEffect } from "react";
import { useOidcClient } from "../OidcClientAtom";

export const AuthnLogout = () => {
	const [oidc] = useOidcClient();
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	useEffect(() => {
		if (!discordEnabled) {
			console.debug({
				AuthnCallback: {
					message: "Processing logout callback",
				},
			});

			oidc?.userManager.signoutCallback().then(async () => {
				let status: SessionStatus | null | undefined;
				let signoutError: unknown;
				try {
					status = await oidc?.userManager.querySessionStatus();
				} catch (error) {
					signoutError = error;
				}
				console.debug({
					AuthnCallback: {
						message: "Navigating to root after sign-out",
						status,
						signoutError,
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
			typeof={"AuthnLogout"}
			data-oidc={oidc ? "true" : "false"}
		/>
	);
};
