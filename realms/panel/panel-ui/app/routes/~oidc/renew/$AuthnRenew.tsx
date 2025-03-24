import { useEffect, useMemo } from "react";
import { useOidcClient } from "../../../atoms/authentication/OidcClientAtom";

export const AuthnRenew = () => {
	const [oidc] = useOidcClient();
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	useEffect(() => {
		if (!discordEnabled) {
			console.debug({
				AuthnRenew: {
					message: "Renew requested",
				},
			});
			oidc?.userManager.signinSilent().then((user) => {
				console.debug({
					AuthnRenew: {
						user,
					},
				});
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
			typeof={"AuthnRenew"}
			data-oidc={oidc ? "true" : "false"}
			suppressHydrationWarning
		/>
	);
};
