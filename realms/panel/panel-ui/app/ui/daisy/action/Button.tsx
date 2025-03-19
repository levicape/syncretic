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
	const { wide, block, square, circle } = buttonProps;
	return (
		<button
			className={clsx(
				"btn",
				className,
				neutral ? "btn-neutral" : "",
				neutral && !supressContentColor ? "text-neutral-content" : "",
				primary ? "btn-primary" : "",
				primary && !supressContentColor ? "text-primary-content" : "",
				secondary ? "btn-secondary" : "",
				secondary && !supressContentColor ? "text-secondary-content" : "",
				accent ? "btn-accent" : "",
				accent && !supressContentColor ? "text-accent-content" : "",
				info ? "btn-info" : "",
				info && !supressContentColor ? "text-info-content" : "",
				success ? "btn-success" : "",
				success && !supressContentColor ? "text-success-content" : "",
				warning ? "btn-warning" : "",
				warning && !supressContentColor ? "text-warning-content" : "",
				error ? "btn-error" : "",
				error && !supressContentColor ? "text-error-content" : "",
				outline ? "btn-outline" : "",
				dash ? "btn-dash" : "",
				soft ? "btn-soft" : "",
				ghost ? "btn-ghost" : "",
				link ? "btn-link" : "",
				active ? "btn-active" : "",
				disabled ? "btn-disabled" : "",
				xs ? "btn-xs" : "",
				sm ? "btn-sm" : "",
				md ? "btn-md" : "",
				lg ? "btn-lg" : "",
				xl ? "btn-xl" : "",
				wide ? "btn-wide" : "",
				block ? "btn-block" : "",
				square ? "btn-square" : "",
				circle ? "btn-circle" : "",
			)}
			{...buttonProps}
		>
			{children}
		</button>
	);
};
