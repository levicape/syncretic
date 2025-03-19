import {
	type FunctionComponent,
	type JSX,
	useCallback,
	useEffect,
} from "react";

/**
 * Capture touch events to prevent default behavior.
 * @kind Island
 * @returns {JSX.Element}
 */
export const CaptureTouchEvents: FunctionComponent = (): JSX.Element => {
	const noop = useCallback(() => {}, []);
	useEffect(() => {
		document.addEventListener("touchstart", noop);

		return () => {
			document.removeEventListener("touchstart", noop);
		};
	}, [noop]);

	return <></>;
};
