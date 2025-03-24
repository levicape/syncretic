import { OidcPage } from "../__OidcPage";
import { AuthnLogout } from "./$AuthnLogout";
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
