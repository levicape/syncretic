import { useEffect, useMemo } from "react";
import { useOidcClient } from "../../../atoms/authentication/OidcClientAtom";

export const AuthnClose = () => {
	const [oidc] = useOidcClient();
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	useEffect(() => {
		if (!discordEnabled) {
			console.debug({
				AuthnClose: {
					message: "Processing auth close",
				},
			});
			oidc?.userManager
				.signoutPopup({
					extraQueryParams: {
						client_id: oidc?.userManager.settings.client_id,
						authority: oidc?.userManager.settings.authority,
						scope: oidc?.userManager.settings.scope,
						response_type: oidc?.userManager.settings.response_type,
					},
				})
				.finally(() => {
					location.replace("/~oidc/logout");
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
			style={style}
			typeof={"AuthnClose"}
			data-oidc={oidc ? "true" : "false"}
			suppressHydrationWarning
		/>
	);
};
