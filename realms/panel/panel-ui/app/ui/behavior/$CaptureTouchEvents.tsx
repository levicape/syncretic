import {
	type FunctionComponent,
	type JSX,
	useCallback,
	useEffect,
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

	return (
		<object
			aria-hidden
			typeof="CaptureTouchEvents"
			data-mounted={String(mounted)}
		/>
	);
};
