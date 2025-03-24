import { Loading } from "../../../ui/daisy/feedback/Loading";
import { OidcPage } from "../__OidcPage";
import { AuthnRenew } from "./$AuthnRenew";

export default async function Renew() {
	return (
		<>
			<OidcPage>
				<Loading className={"loading-spinner bg-clip-content"} size={"xl"} />
			</OidcPage>
			<AuthnRenew />
		</>
	);
}
