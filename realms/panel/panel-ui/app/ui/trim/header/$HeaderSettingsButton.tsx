import { clsx } from "clsx";
import {
	type FunctionComponent,
	type PropsWithChildren,
	useCallback,
	useContext,
} from "react";
import { Button } from "../../daisy/action/Button";
import { Cog_Icon } from "../../display/icons/Cog";
import {
	HeaderMenuOpenContextExport,
	HeaderSettingsOpenContextExport,
} from "./HeaderContext";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();
const HeaderSettingsOpenContext = HeaderSettingsOpenContextExport();
export const HeaderSettingsButton: FunctionComponent<
	PropsWithChildren<{ className: string }>
> = ({ children, className }) => {
	const pathname =
		typeof window !== "undefined" ? window.location?.pathname : "/";
	//   const { ready: authReady } = useStoreSelector(getAuthentication);
	const [menuOpen] = useContext(HeaderMenuOpenContext);
	const [, setHeaderSettingsOpen] = useContext(HeaderSettingsOpenContext);

	const isLoginScreen = pathname === "/~oidc/authorize";
	const hide = isLoginScreen || menuOpen; // || authReady !== true;

	const menuButtonOnClick = useCallback(() => {
		setHeaderSettingsOpen();
	}, [setHeaderSettingsOpen]);

	return (
		<Button
			className={clsx("p-1", hide ? "invisible" : "", className)}
			variant={"ghost"}
			square
			onClick={menuButtonOnClick}
		>
			<Cog_Icon />
			{children}
		</Button>
	);
};
