import { AuthnLogout } from "../../../atoms/authentication/behavior/$AuthnLogout";
import { OidcPage } from "../__OidcPage";
import { LogoutProgress } from "./$LogoutProgress";

export default async function Callback() {
	return (
		<>
			<OidcPage>
				<LogoutProgress />
			</OidcPage>
			<AuthnLogout />
		</>
	);
}
