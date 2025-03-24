import { OidcPage } from "../__OidcPage";
import { AuthnAuthorize } from "./$AuthnAuthorize";
import { AuthorizeProgress } from "./$AuthorizeProgress";

export default async function Authorize() {
	return (
		<>
			<OidcPage>
				<AuthorizeProgress />
			</OidcPage>
			<AuthnAuthorize />
		</>
	);
}
