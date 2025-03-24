import { clsx } from "clsx";
import {
	type FunctionComponent,
	type PropsWithChildren,
	useCallback,
	useEffect,
	useState,
} from "react";
import { DesignSystem } from "../../DesignSystem";
import { Navbar } from "../../daisy/navigation/Navbar";
import { HeaderMenuButton } from "./$HeaderMenuButton";
import { HeaderMenuSidebar } from "./$HeaderMenuSidebar";
import {
	HeaderMenuOpenContextExport,
	HeaderSettingsOpenContextExport,
} from "./HeaderContext";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();
const HeaderSettingsOpenContext = HeaderSettingsOpenContextExport();

export type HeaderDrawerProps = {
	requestPath?: string;
	vars: {
		appHeight: string;
	};
};

export const HeaderDrawer: FunctionComponent<
	PropsWithChildren<HeaderDrawerProps>
> = (props) => {
	const { children, vars, requestPath } = props;
	const pathname =
		typeof window !== "undefined"
			? window.location.pathname
			: (requestPath ?? "/");
	const [loading, setLoading] = useState<boolean>(true);
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
			scrollToTop();
			setMenuOpen(value || !menuOpen);
			setSettingsOpen(false);
			setWindowHeight(menuOpen === false ? window.innerHeight : null);
		},
		[scrollToTop, menuOpen],
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

	if (pathname.startsWith("/~")) {
		return <div className={clsx("min-h-12")} />;
	}

	useEffect(() => {
		const update = () => {
			setLoading(false);
		};

		const immediate = setTimeout(update, 10);
		return () => {
			clearTimeout(immediate);
		};
	}, []);

	// const a = useAtomValue(AuthenticationAtom);
	return (
		<HeaderMenuOpenContext.Provider value={[menuOpen, menuOpenOnChange]}>
			<HeaderSettingsOpenContext.Provider
				value={[settingsOpen, settingsOpenOnChange]}
			>
				<HeaderMenuSidebar />
				<div
					suppressHydrationWarning
					className={clsx(
						"relative",
						"z-40",
						menuOpen ? "translate-x-64" : undefined,
						"transition-transform",
						"duration-600",
						"ease-out",
						"will-change-auto",
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
							"to-base-300",
							"transition-all",
							"transition-discrete",
							"will-change-auto",
							...(loading ? ["opacity-40", "blur-xl"] : []),
						)}
						start={
							!loading ? <HeaderMenuButton className={clsx("p-1")} /> : null
						}
						center={<DesignSystem.Header>{children}</DesignSystem.Header>}
						end={
							pathname
							// <HeaderSettingsButton
							// 	className={clsx("p-1", "md:block", "md:relative")}
							// >
							// 	{/* <HeaderSettingsModal /> */}
							// </HeaderSettingsButton>
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
