import { AuthnCallback } from "../../../atoms/authentication/behavior/$AuthnCallback";
import { OidcPage } from "../__OidcPage";
import { CallbackProgress } from "./$CallbackProgress";

export default async function Callback() {
	return (
		<>
			<OidcPage>
				<CallbackProgress />
			</OidcPage>
			<AuthnCallback />
		</>
	);
}
