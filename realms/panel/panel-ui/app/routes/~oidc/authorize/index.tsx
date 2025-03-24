import { AuthnRedirect } from "../../../atoms/authentication/behavior/$AuthnRedirect";
import { OidcPage } from "../__OidcPage";
import { AuthorizeProgress } from "./$AuthorizeProgress";

export default async function Authorize() {
	return (
		<>
			<OidcPage>
				<AuthorizeProgress />
			</OidcPage>
			<AuthnRedirect />
		</>
	);
}
