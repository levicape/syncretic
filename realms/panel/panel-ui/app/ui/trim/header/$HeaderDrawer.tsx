import { clsx } from "clsx";
import {
	type FunctionComponent,
	type PropsWithChildren,
	useCallback,
	useState,
} from "react";
import { DesignSystem } from "../../DesignSystem";
import { Navbar } from "../../daisy/navigation/Navbar";
import { HeaderMenuButton } from "./$HeaderMenuButton";
import { HeaderMenuSidebar } from "./$HeaderMenuSidebar";
import { HeaderSettingsButton } from "./$HeaderSettingsButton";
import {
	HeaderMenuOpenContextExport,
	HeaderSettingsOpenContextExport,
} from "./HeaderContext";
// import { useAtomValue } from "jotai/react";
// import { AuthenticationAtom } from "../../../atoms/authentication/OidcClientAtom";
// import { HeaderSettingsModal } from "./HeaderSettingsModal";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();
const HeaderSettingsOpenContext = HeaderSettingsOpenContextExport();

export type HeaderDrawerProps = {
	vars: {
		appHeight: string;
	};
};

export const HeaderDrawer: FunctionComponent<
	PropsWithChildren<HeaderDrawerProps>
> = (props) => {
	const { children, vars } = props;
	const pathname =
		typeof window !== "undefined" ? window.location.pathname : "/";
	const [menuOpen, setMenuOpen] = useState<boolean>(false);
	const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
	const [windowHeight, setWindowHeight] = useState<number | null>(null);

	const showOverlay = menuOpen || settingsOpen;

	const scrollToTop = useCallback(() => {
		if (window && typeof window.scrollTo === "function") {
			window.scrollTo(0, 1);
		}
	}, []);

	const menuOpenOnChange = useCallback(
		(value?: boolean) => {
			if (pathname.startsWith("/~oidc")) {
				return;
			}

			scrollToTop();
			setMenuOpen(value || !menuOpen);
			setSettingsOpen(false);
			setWindowHeight(menuOpen === false ? window.innerHeight : null);
		},
		[scrollToTop, pathname, menuOpen],
	);

	const settingsOpenOnChange = useCallback(
		(value?: boolean) => {
			scrollToTop();
			setSettingsOpen(value || !settingsOpen);
			setMenuOpen(false);
			setWindowHeight(settingsOpen === false ? window.innerHeight : null);
		},
		[scrollToTop, settingsOpen],
	);

	const closeModalOnClick = useCallback<React.MouseEventHandler>(
		(event) => {
			if (showOverlay) {
				event.preventDefault();
				setMenuOpen(false);
				setSettingsOpen(false);
				setWindowHeight(null);
			}
		},
		[showOverlay],
	);

	const closeModalOnKeydown = useCallback<React.KeyboardEventHandler>(
		(event) => {
			if (event.key === "Escape" && showOverlay) {
				event.preventDefault();
				setMenuOpen(false);
				setSettingsOpen(false);
				setWindowHeight(null);
			}
		},
		[showOverlay],
	);

	// const a = useAtomValue(AuthenticationAtom);
	return (
		<HeaderMenuOpenContext.Provider value={[menuOpen, menuOpenOnChange]}>
			<HeaderSettingsOpenContext.Provider
				value={[settingsOpen, settingsOpenOnChange]}
			>
				<HeaderMenuSidebar />
				<div
					className={clsx(
						"relative",
						"z-40",
						menuOpen ? "translate-x-64" : undefined,
						"transition-transform",
						"duration-200",
						"ease-out",
						"will-change-transform",
					)}
				>
					<Navbar
						role={"navigation"}
						background={"bg-base-200"}
						text={"text-base-content"}
						shadow={"shadow-sm"}
						className={clsx(
							"flex",
							"min-h-[2.5rem]",
							"bg-gradient-to-b",
							"backdrop-blur-lg",
							"to-base-300",
						)}
						start={<HeaderMenuButton className={clsx("p-1")} />}
						center={<DesignSystem.Header>{children}</DesignSystem.Header>}
						end={
							<HeaderSettingsButton
								className={clsx("p-1", "md:block", "md:relative")}
							>
								{/* <HeaderSettingsModal /> */}
							</HeaderSettingsButton>
						}
					/>
				</div>
				<div
					className={clsx(
						"fixed",
						"top-8",
						"left-0",
						"right-0",
						"bottom-0",
						"p-3",
						"m-3",
						"z-30",
						"bg-gray-900",
						"transition-opacity",
						showOverlay
							? "pointer-events-auto opacity-50"
							: "pointer-events-none opacity-0",
					)}
					onClick={closeModalOnClick}
					onKeyDown={closeModalOnKeydown}
				/>
				<style>
					{`:root {
						${windowHeight ? `${vars.appHeight}: ${windowHeight + 10}px;` : ""}
					}`}
				</style>
			</HeaderSettingsOpenContext.Provider>
		</HeaderMenuOpenContext.Provider>
	);
};
