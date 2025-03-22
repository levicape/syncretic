import clsx from "clsx";
import type {
	ButtonHTMLAttributes,
	FunctionComponent,
	PropsWithChildren,
} from "react";

export type DaisyButtonColor =
	| "neutral"
	| "primary"
	| "secondary"
	| "accent"
	| "info"
	| "success"
	| "warning"
	| "error";
export type DaisyButtonVariant = "outline" | "dash" | "soft" | "ghost" | "link";
export type DaisyButtonBehavior = "active" | "disabled";
export type DaisyButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
export type DaisyButtonModifier = "wide" | "block" | "square" | "circle";

export type ButtonProps = {
	color?: DaisyButtonColor;
	supressContentColor?: boolean;
	variant?: DaisyButtonVariant;
	size?: DaisyButtonSize;
} & {
	[key in DaisyButtonBehavior]?: boolean;
} & {
	[key in DaisyButtonModifier]?: boolean;
};

export const Button: FunctionComponent<
	PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & ButtonProps
> = ({ children, className, ...buttonProps }) => {
	const { color, variant, size, supressContentColor } = buttonProps;
	const { neutral, primary, secondary, accent, info, success, warning, error } =
		{ [color ?? "neutral"]: true } as Record<string, boolean>;
	const { outline, dash, soft, ghost, link } = variant
		? ({ [variant]: true } as Record<string, boolean>)
		: {};
	const { active, disabled } = buttonProps;
	const { xs, sm, md, lg, xl } = size
		? ({ [size]: true } as Record<string, boolean>)
		: {};

	const { wide, block, square, circle, ...htmlProps } = buttonProps;

	return (
		<button
			className={clsx(
				"btn",
				className,
				neutral ? "btn-neutral" : undefined,
				neutral && !supressContentColor ? "text-neutral-content" : undefined,
				primary ? "btn-primary" : undefined,
				primary && !supressContentColor ? "text-primary-content" : undefined,
				secondary ? "btn-secondary" : undefined,
				secondary && !supressContentColor
					? "text-secondary-content"
					: undefined,
				accent ? "btn-accent" : undefined,
				accent && !supressContentColor ? "text-accent-content" : undefined,
				info ? "btn-info" : undefined,
				info && !supressContentColor ? "text-info-content" : undefined,
				success ? "btn-success" : undefined,
				success && !supressContentColor ? "text-success-content" : undefined,
				warning ? "btn-warning" : undefined,
				warning && !supressContentColor ? "text-warning-content" : undefined,
				error ? "btn-error" : undefined,
				error && !supressContentColor ? "text-error-content" : undefined,
				outline ? "btn-outline" : undefined,
				dash ? "btn-dash" : undefined,
				soft ? "btn-soft" : undefined,
				ghost ? "btn-ghost" : undefined,
				link ? "btn-link" : undefined,
				active ? "btn-active" : undefined,
				disabled ? "btn-disabled" : undefined,
				xs ? "btn-xs" : undefined,
				sm ? "btn-sm" : undefined,
				md ? "btn-md" : undefined,
				lg ? "btn-lg" : undefined,
				xl ? "btn-xl" : undefined,
				wide ? "btn-wide" : undefined,
				block ? "btn-block" : undefined,
				square ? "btn-square" : undefined,
				circle ? "btn-circle" : undefined,
			)}
			{...htmlProps}
		>
			{children}
		</button>
	);
};
