import { clsx } from "clsx";
import type { BaseHTMLAttributes, ElementType, PropsWithChildren } from "react";

export type LoadingColor =
	| "neutral"
	| "primary"
	| "secondary"
	| "accent"
	| "info"
	| "success"
	| "warning"
	| "error";

export type LoadingVariant =
	| "ball"
	| "bars"
	| "infinity"
	| "spinner"
	| "dots"
	| "ring";

export type LoadingSize = "xs" | "sm" | "md" | "lg" | "xl";

export type LoadingProps = {
	className?: string;
	/**
	 *
	 * The color of the loading indicator
	 */
	color?: LoadingColor;
	/**
	 *
	 * The variant of the loading indicator
	 */
	variant?: LoadingVariant;
	/**
	 *
	 * The size of the loading indicator
	 */
	size?: LoadingSize;
	/**
	 *
	 * Replace the root `<span>` with a different element
	 */
	render?: ElementType;
};

/**
 * Loading indicator component.
 */
export const Loading = <RenderedElement extends HTMLElement>({
	className,
	color,
	variant,
	size,
	children,
	render: Component = "span",
	...htmlProps
}: PropsWithChildren<LoadingProps> & BaseHTMLAttributes<RenderedElement>) => {
	const { xs, sm, md, lg, xl } = size
		? ({ [size]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	const { ball, bars, infinity, spinner, dots, ring } = variant
		? ({ [variant]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	const { horizontal, vertical } = variant
		? ({ [variant]: true } as Record<string, boolean | undefined>)
		: ({} as Record<string, boolean | undefined>);

	const { neutral, primary, secondary, accent, info, success, warning, error } =
		color
			? ({ [color]: true } as Record<string, boolean | undefined>)
			: ({} as Record<string, boolean | undefined>);

	return (
		<Component
			className={clsx(
				"loading",
				horizontal ? "loading-horizontal" : undefined,
				vertical ? "loading-vertical" : undefined,
				xs ? "loading-xs" : undefined,
				sm ? "loading-sm" : undefined,
				md ? "loading-md" : undefined,
				lg ? "loading-lg" : undefined,
				xl ? "loading-xl" : undefined,
				ball ? "loading-ball" : undefined,
				bars ? "loading-bars" : undefined,
				infinity ? "loading-infinity" : undefined,
				spinner ? "loading-spinner" : undefined,
				dots ? "loading-dots" : undefined,
				ring ? "loading-ring" : undefined,
				neutral ? "text-neutral" : undefined,
				primary ? "text-primary" : undefined,
				secondary ? "text-secondary" : undefined,
				accent ? "text-accent" : undefined,
				info ? "text-info" : undefined,
				success ? "text-success" : undefined,
				warning ? "text-warning" : undefined,
				error ? "text-error" : undefined,
				className,
			)}
			{...htmlProps}
		>
			{children}
		</Component>
	);
};
