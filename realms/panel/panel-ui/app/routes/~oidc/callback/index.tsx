import { OidcPage } from "../__OidcPage";
import { AuthnCallback } from "./$AuthnCallback";
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
