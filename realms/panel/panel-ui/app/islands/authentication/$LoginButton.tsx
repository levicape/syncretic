import { useOidcClient } from "../../atoms/authentication/OidcClientAtom";
import { Button, type ButtonProps } from "../../ui/daisy/action/Button";

export type LoginButtonProps = {
	$NOLINT?: never;
};

export const LoginButton = (props: LoginButtonProps & ButtonProps) => {
	const [oidc] = useOidcClient();

	return (
		<>
			<Button
				{...props}
				onClick={() => {
					console.log({
						LoginButton: {
							message: "Login button clicked",
							oidc,
						},
					});
					oidc?.userManager.signinRedirect();
				}}
			>
				Login
			</Button>
		</>
	);
};
