import clsx from "clsx";
import type { BaseHTMLAttributes, PropsWithChildren } from "react";

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

/**
 * A menu component that can be used to create a list of items.
 * This component should only be used for display purposes.
 *
 * For more complex usages:
 * @see [BaseMenu]
 */
export const DaisyMenu = (
	props: PropsWithChildren<DaisyMenuProps> &
		BaseHTMLAttributes<HTMLMenuElement>,
) => {
	const { className, size, direction, ...htmlProps } = props;
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
				xs ? "menu-xs" : undefined,
				sm ? "menu-sm" : undefined,
				md ? "menu-md" : undefined,
				lg ? "menu-lg" : undefined,
				xl ? "menu-xl" : undefined,
				horizontal ? "menu-horizontal" : undefined,
				vertical ? "menu-vertical" : undefined,
				className,
			)}
			{...htmlProps}
		>
			{props.children}
		</menu>
	);
};

/**
 * Menu item component.
 *
 * This component should only be used for display purposes.
 * For more complex usages:
 * @see [DaisyMenu]
 * @see [BaseMenu]
 */
export const DaisyMenuItem = (
	props: PropsWithChildren<DaisyMenuItemProps> &
		BaseHTMLAttributes<HTMLLIElement>,
) => {
	const { className, variant, ...htmlProps } = props;
	const { disabled, active, focused } = variant
		? ({ [variant]: true } as Record<string, boolean>)
		: {};

	return (
		<li
			className={clsx(
				disabled ? "menu-disabled" : undefined,
				active ? "menu-active" : undefined,
				focused ? "menu-focused" : undefined,
				className,
			)}
			{...htmlProps}
		>
			{props.children}
		</li>
	);
};
