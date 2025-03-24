import {
	type FunctionComponent,
	type JSX,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

/**
 * Capture touch events to prevent default behavior.
 * @kind Island
 * @returns {JSX.Element}
 */
export const CaptureTouchEvents: FunctionComponent = (): JSX.Element => {
	const [mounted, setMounted] = useState(false);
	const noop = useCallback(() => {}, []);
	useEffect(() => {
		if (
			typeof document !== "undefined" &&
			document?.addEventListener !== undefined
		) {
			document.addEventListener("touchstart", noop);
			setMounted(true);
		}

		return () => {
			setMounted(false);
			if (
				typeof document !== "undefined" &&
				document?.removeEventListener !== undefined
			) {
				document.removeEventListener("touchstart", noop);
			}
		};
	}, [noop]);

	const style: React.CSSProperties = useMemo(
		() => ({
			display: "none",
			pointerEvents: "none",
			touchAction: "none",
			position: "fixed",
			visibility: "hidden",
			width: 0,
			height: 0,
			top: 0,
			left: 0,
			zIndex: -1,
		}),
		[],
	);

	return (
		<object
			aria-hidden
			style={style}
			typeof="CaptureTouchEvents"
			data-mounted={String(mounted)}
		/>
	);
};
