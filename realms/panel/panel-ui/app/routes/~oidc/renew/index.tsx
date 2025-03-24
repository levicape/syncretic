import { AuthnRenew } from "../../../atoms/authentication/behavior/$AuthnRenew";
import { Loading } from "../../../ui/daisy/feedback/Loading";
import { OidcPage } from "../__OidcPage";

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
