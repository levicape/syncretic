import { clsx } from "clsx";
import { type FunctionComponent, useCallback, useContext } from "react";
import { Button } from "../../daisy/action/Button";
import { Bars4_Icon } from "../../display/icons/Bars4";
import { HeaderMenuOpenContextExport } from "./HeaderContext";
// import { LanguageDropdown } from "@/ui/input/LanguageDropdown";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();

export const HeaderMenuButton: FunctionComponent = () => {
	// const { ready: authReady } = useStoreSelector(getAuthentication);
	const [menuOpen, setHeaderMenuOpen] = useContext(HeaderMenuOpenContext);

	// if (authReady !== true) {
	//   return (
	//     <span className={"self-center px-2"}>
	//       <LanguageDropdown />
	//     </span>
	//   );
	// }

	const menuButtonOnClick = useCallback(() => {
		setHeaderMenuOpen();
	}, [setHeaderMenuOpen]);

	return (
		<Button
			color={"neutral"}
			variant={"ghost"}
			square
			className={clsx("p-1", menuOpen ? "invisible" : "")}
			onClick={menuButtonOnClick}
		>
			<Bars4_Icon />
		</Button>
	);
};
