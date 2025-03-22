import { clsx } from "clsx";
import { type FunctionComponent, useCallback, useContext } from "react";
import { useFormatMessage } from "../../../atoms/localization/I18nAtom";
import { Button } from "../../daisy/action/Button";
import { Bars4_Icon } from "../../display/icons/Bars4";
import { HeaderMenuOpenContextExport } from "./HeaderContext";
// import { LanguageDropdown } from "@/ui/input/LanguageDropdown";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();

export type HeaderMenuButtonProps = {
	className?: string;
};

export const HeaderMenuButton: FunctionComponent<HeaderMenuButtonProps> = (
	props,
) => {
	// const { ready: authReady } = useStoreSelector(getAuthentication);
	const formatMessage = useFormatMessage();
	const [menuOpen, setHeaderMenuOpen] = useContext(HeaderMenuOpenContext);

	const { className } = props;

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
			role={"menubar"}
			aria-label={formatMessage({
				id: "ui.trim.header.menu.button.aria-label",
				defaultMessage: "Open Navigation Menu",
				description: "aria-label for HeaderMenuButton",
			})}
			color={"neutral"}
			variant={"ghost"}
			square
			className={clsx(menuOpen ? "invisible" : undefined, className)}
			onClick={menuButtonOnClick}
		>
			<Bars4_Icon />
		</Button>
	);
};
