import clsx from "clsx";
import type { PropsWithChildren } from "react";

export type DaisyMenuItemVariant = "disabled" | "active" | "focused";

export type DaisyMenuSize = "xs" | "sm" | "md" | "lg" | "xl";

export type DaisyMenuDirection = "horizontal" | "vertical";

export type DaisyMenuProps = {
	className?: string;
	size?: DaisyMenuSize;
	direction?: DaisyMenuDirection;
};

export type DaisyMenuItemProps = {
	className?: string;
	variant?: DaisyMenuItemVariant;
};

export const DaisyMenu = (props: PropsWithChildren<DaisyMenuProps>) => {
	const { className, size, direction } = props;
	const { xs, sm, md, lg, xl } = size
		? ({ [size]: true } as Record<string, boolean>)
		: {};
	const { horizontal, vertical } = direction
		? ({ [direction]: true } as Record<string, boolean>)
		: {};

	return (
		<menu
			role={"menu"}
			className={clsx(
				"menu",
				xs ? "menu-xs" : "",
				sm ? "menu-sm" : "",
				md ? "menu-md" : "",
				lg ? "menu-lg" : "",
				xl ? "menu-xl" : "",
				horizontal ? "menu-horizontal" : "",
				vertical ? "menu-vertical" : "",
				className,
			)}
		>
			{props.children}
		</menu>
	);
};

export const DaisyMenuItem = (props: PropsWithChildren<DaisyMenuItemProps>) => {
	const { className, variant } = props;
	const { disabled, active, focused } = variant
		? ({ [variant]: true } as Record<string, boolean>)
		: {};

	return (
		<li
			className={clsx(
				disabled ? "menu-disabled" : "",
				active ? "menu-active" : "",
				focused ? "menu-focused" : "",
				className,
			)}
		>
			{props.children}
		</li>
	);
};
