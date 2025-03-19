import { clsx } from "clsx";
import { useAtomValue } from "jotai/react";
import type React from "react";
import {
	type FunctionComponent,
	type PropsWithChildren,
	useCallback,
	useState,
} from "react";
import { AuthenticationAtom } from "../../../atoms/authentication/AuthenticationAtom";
import { ApplicationHead, DesignSystem } from "../../DesignSystem";
import { Navbar } from "../../daisy/navigation/Navbar";
import { HeaderMenuButton } from "./$HeaderMenuButton";
import { HeaderMenuSidebar } from "./$HeaderMenuSidebar";
import { HeaderSettingsButton } from "./$HeaderSettingsButton";
import {
	HeaderMenuOpenContextExport,
	HeaderSettingsOpenContextExport,
} from "./HeaderContext";
// import { HeaderSettingsModal } from "./HeaderSettingsModal";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();
const HeaderSettingsOpenContext = HeaderSettingsOpenContextExport();

export const HeaderDrawer: FunctionComponent<PropsWithChildren> = () => {
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

	const a = useAtomValue(AuthenticationAtom);
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
						menuOpen ? "translate-x-64" : "",
						"transition-transform",
						"duration-200",
						"ease-out",
						"will-change-transform",
						"sticky",
					)}
				>
					<Navbar
						background={"bg-base-200"}
						text={"text-primary-content"}
						shadow={"shadow-sm"}
						className={clsx(
							"flex",
							"min-h-[2.5rem]",
							"bg-gradient-to-b",
							"backdrop-blur-lg",
							"to-base-300",
						)}
						start={<HeaderMenuButton />}
						center={
							<DesignSystem.Header className={clsx("text-2xl", "font-bold")}>
								{ApplicationHead.title.default}
							</DesignSystem.Header>
						}
						end={
							<HeaderSettingsButton className={clsx("hidden", "md:block")}>
								{/* <HeaderSettingsModal /> */}
								{a}
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
						${windowHeight ? `--app-height: ${windowHeight + 10}px;` : ""}
					}`}
				</style>
			</HeaderSettingsOpenContext.Provider>
		</HeaderMenuOpenContext.Provider>
	);
};

/*
{			

}
*/
