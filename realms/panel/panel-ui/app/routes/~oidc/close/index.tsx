import { OidcPage } from "../__OidcPage";
import { AuthnClose } from "./$AuthnClose";
import { CloseProgress } from "./$CloseProgress";

export default async function Close() {
	return (
		<>
			<OidcPage>
				<CloseProgress />
			</OidcPage>
			<AuthnClose />
		</>
	);
}
