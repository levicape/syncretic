import { clsx } from "clsx";
import { type FunctionComponent, type PropsWithChildren, useMemo } from "react";
import { ApplicationHead } from "../../DesignSystem";
import { HeaderDrawer } from "./$HeaderDrawer";

export const HeaderLayout: FunctionComponent<
	PropsWithChildren<{
		vars: {
			appHeight: string;
		};
	}>
> = ({ children, vars }) => {
	return (
		<div
			style={useMemo(
				() => ({ height: `var(${vars.appHeight})` }),
				[vars.appHeight],
			)}
		>
			<HeaderDrawer vars={vars}>{ApplicationHead.title.default}</HeaderDrawer>
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
