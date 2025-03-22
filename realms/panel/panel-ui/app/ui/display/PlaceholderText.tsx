import { clsx } from "clsx";
import type { FunctionComponent, PropsWithChildren } from "react";

export type PlaceholderTextProps = {
	block?: boolean;
};

export const PlaceholderText: FunctionComponent<
	PropsWithChildren<PlaceholderTextProps>
> = ({ children, block }) => {
	return (
		<span
			className={clsx(
				"animate-pulse",
				"cursor-default",
				"select-none",
				"rounded-sm",
				"bg-gray-100/10",
				"text-transparent",
				block ? "block" : undefined,
			)}
		>
			{children}
		</span>
	);
};
