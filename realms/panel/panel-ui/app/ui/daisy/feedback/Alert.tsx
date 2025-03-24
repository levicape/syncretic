import { clsx } from "clsx";
import type { BaseHTMLAttributes, PropsWithChildren } from "react";

export type AlertProps = {
	className?: string;
	color?: "info" | "success" | "warning" | "error";
	variant?: "outline" | "dash" | "soft";
	direction?: "horizontal" | "vertical";
};

export const Alert = ({
	className,
	color,
	variant,
	direction,
	children,
	...htmlProps
}: PropsWithChildren<AlertProps> & BaseHTMLAttributes<HTMLDivElement>) => {
	const { horizontal, vertical } = direction
		? ({ [direction]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	const { info, success, warning, error } = color
		? ({ [color]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	const { outline, dash, soft } = variant
		? ({ [variant]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	return (
		<div
			className={clsx(
				"alert",
				horizontal ? "alert-horizontal" : undefined,
				vertical ? "alert-vertical" : undefined,
				info ? "alert-info" : undefined,
				success ? "alert-success" : undefined,
				warning ? "alert-warning" : undefined,
				error ? "alert-error" : undefined,
				outline ? "alert-outline" : undefined,
				dash ? "alert-dash" : undefined,
				soft ? "alert-soft" : undefined,
				className,
			)}
			{...htmlProps}
		>
			{children}
		</div>
	);
};
