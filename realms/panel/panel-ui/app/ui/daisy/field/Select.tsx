import { clsx } from "clsx";
import type { PropsWithChildren } from "react";

export type SelectColor =
	| "neutral"
	| "primary"
	| "secondary"
	| "accent"
	| "info"
	| "success"
	| "warning"
	| "error";

export type SelectVariant = "ghost";
export type SelectSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SelectProps = {
	className?: string;
	color?: SelectColor;
	variant?: SelectVariant;
	size?: SelectSize;
};

export const Select = (
	props: PropsWithChildren<SelectProps> &
		React.SelectHTMLAttributes<HTMLSelectElement>,
) => {
	const { children, className, color, size, ...selectProps } = props;

	const { neutral, primary, secondary, accent, info, success, warning, error } =
		color ? ({ [color]: true } as Record<string, boolean>) : {};

	const { xs, sm, md, lg, xl } = size
		? ({ [size]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	const { ghost } = props.variant
		? ({ [props.variant]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	return (
		<select
			className={clsx(
				"select",
				xs ? "select-xs" : undefined,
				sm ? "select-sm" : undefined,
				md ? "select-md" : undefined,
				lg ? "select-lg" : undefined,
				xl ? "select-xl" : undefined,
				neutral ? "select-neutral" : undefined,
				primary ? "select-primary" : undefined,
				secondary ? "select-secondary" : undefined,
				accent ? "select-accent" : undefined,
				info ? "select-info" : undefined,
				success ? "select-success" : undefined,
				warning ? "select-warning" : undefined,
				error ? "select-error" : undefined,
				ghost ? "select-ghost" : undefined,
				className,
			)}
			{...selectProps}
		>
			{children}
		</select>
	);
};
