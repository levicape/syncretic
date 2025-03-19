import { clsx } from "clsx";
import type { PropsWithChildren, ReactElement } from "react";

export type StatsDirection = "horizontal" | "vertical";
export type StatsProps = {
	direction?: StatsDirection;
	className?: string;
};

export type StatProps = {
	className?: string;
	valueClassName?: string;
	title?: ReactElement;
	titleClassName?: string;
	description?: ReactElement;
	descriptionClassName?: string;
	icon?: ReactElement;
	iconClassName?: string;
	actions?: ReactElement;
	actionsClassName?: string;
};

export const Stats = (props: PropsWithChildren<StatsProps>) => {
	const { direction, children, className } = props;
	const { horizontal, vertical } = direction
		? ({ [direction]: true } as Record<string, boolean | undefined>)
		: ({ horizontal: true } as Record<string, boolean | undefined>);

	return (
		<div
			className={clsx(
				"stats",
				horizontal ? "stats-horizontal" : "",
				vertical ? "stats-vertical" : "",
				className,
			)}
		>
			{children}
		</div>
	);
};

export const Stat = ({
	title,
	children,
	description,
	icon,
	actions,
	className,
	iconClassName,
	titleClassName,
	valueClassName,
	descriptionClassName,
	actionsClassName,
}: PropsWithChildren<StatProps>) => {
	return (
		<div className={clsx("stat", className)}>
			{icon ? (
				<div className={clsx("stat-figure", iconClassName)}>{icon}</div>
			) : null}
			{title ? (
				<div className={clsx("stat-title", titleClassName)}>{title}</div>
			) : null}
			{children ? (
				<div className={clsx("stat-value", valueClassName)}>{children}</div>
			) : null}
			{description ? (
				<div className={clsx("stat-desc", descriptionClassName)}>
					{description}
				</div>
			) : null}
			{actions ? (
				<div className={clsx("stat-actions", actionsClassName)}>{actions}</div>
			) : null}
		</div>
	);
};
