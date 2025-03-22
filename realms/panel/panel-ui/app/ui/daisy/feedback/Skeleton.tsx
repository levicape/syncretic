import clsx from "clsx";
import type { BaseHTMLAttributes, ElementType } from "react";

export type SkeletonProps = {
	className?: string;
	/**
	 *
	 * Replace the root `<div>` with a different element
	 */
	render?: ElementType;
};

/**
 * Skeleton component used for blocking out content while loading
 */
export const Skeleton = <RenderedElement extends HTMLElement>({
	className,
	render,
	...htmlProps
}: SkeletonProps & BaseHTMLAttributes<RenderedElement>) => {
	const Render = render ?? "div";
	return <Render className={clsx("skeleton", className)} {...htmlProps} />;
};
