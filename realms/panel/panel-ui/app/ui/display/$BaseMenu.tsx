import { Menu } from "@base-ui-components/react";
import clsx from "clsx";
import type { MouseEventHandler, PropsWithChildren, ReactElement } from "react";

export type DaisyMenuItemVariant = "disabled" | "active" | "focused";

export type DaisyMenuSize = "xs" | "sm" | "md" | "lg" | "xl";

export type DaisyMenuDirection = "horizontal" | "vertical";

export type MenuProps = {
	className?: string;
	size?: DaisyMenuSize;
	portalProps?: Menu.Portal.Props;
	positionerProps?: Menu.Positioner.Props;
	popupRender?: ReactElement<Record<string, unknown>>;
	popupClassName?: string;
	arrowRender?: ReactElement<Record<string, unknown>>;
	arrowClassName?: string;
	trigger?: ReactElement;
	triggerRender?: ReactElement<Record<string, unknown>>;
	triggerClassName?: string;
} & Menu.Root.Props;

export type MenuItemProps = {
	className?: string;
	label?: string;
	onClick?: MouseEventHandler<unknown>;
	closeOnClick?: boolean;
	variant?: DaisyMenuItemVariant;
};

export const BaseMenu = (props: PropsWithChildren<MenuProps>) => {
	const { className, size } = props;
	const { trigger, triggerRender, triggerClassName } = props;
	const { positionerProps } = props;
	const { portalProps } = props;
	const { popupRender, popupClassName } = props;
	const { arrowRender, arrowClassName } = props;
	const { disabled } = props;
	const { xs, sm, md, lg, xl } = size
		? ({ [size]: true } as Record<string, boolean | undefined>)
		: {};
	const { horizontal, vertical } = props.orientation
		? ({ [props.orientation]: true } as Record<string, boolean | undefined>)
		: {};

	return (
		<Menu.Root {...props}>
			{trigger ? (
				<Menu.Trigger
					className={triggerClassName}
					disabled={disabled}
					render={triggerRender}
				>
					{trigger}
				</Menu.Trigger>
			) : null}
			<Menu.Portal {...portalProps}>
				<Menu.Backdrop
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
				/>
				<Menu.Positioner {...positionerProps}>
					<Menu.Popup className={popupClassName} render={popupRender}>
						<Menu.Arrow className={arrowClassName} render={arrowRender} />
						{props.children}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
};

export const MenuItem = (props: PropsWithChildren<MenuItemProps>) => {
	const { className, variant } = props;
	const { disabled, active, focused } = variant
		? ({ [variant]: true } as Record<string, boolean | undefined>)
		: {};

	return (
		<Menu.Item
			{...props}
			disabled={disabled}
			className={clsx(
				disabled ? "menu-disabled" : undefined,
				active ? "menu-active" : undefined,
				focused ? "menu-focused" : undefined,
				className,
			)}
		>
			{props.children}
		</Menu.Item>
	);
};
