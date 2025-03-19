import { clsx } from "clsx";
import type { FunctionComponent, PropsWithChildren } from "react";
import { HeaderDrawer } from "./$HeaderDrawer";

export const HeaderLayout: FunctionComponent<PropsWithChildren> = ({
	children,
}) => {
	// TODO: Export --app-height
	return (
		<div style={{ height: "var(--app-height)" }}>
			<HeaderDrawer />
			<div
				className={clsx(
					"m-auto",
					"-mt-1",
					"max-w-5xl",
					"pb-1",
					"md:p-3",
					"md:pb-1",
				)}
			>
				{children}
			</div>
		</div>
	);
};
