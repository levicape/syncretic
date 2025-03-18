export const SUSPENSE_GUARD = "<SUSPENSE_GUARD>";
export const SuspenseGuard = () => {
	if (typeof window === "undefined") {
		throw new Error(SUSPENSE_GUARD);
	}
};
