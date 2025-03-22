import clsx from "clsx";
import type {
	BaseHTMLAttributes,
	FunctionComponent,
	PropsWithChildren,
	ReactNode,
} from "react";

export type NavbarProps = {
	className?: string;
	background?: `bg-${string}`;
	text?: `text-${string}`;
	shadow?: `shadow-${string}` | null;
	start?: ReactNode;
	startHtmlProps?: BaseHTMLAttributes<HTMLDivElement>;
	startClassName?: string;
	center?: ReactNode;
	centerHtmlProps?: BaseHTMLAttributes<HTMLDivElement>;
	centerClassName?: string;
	end?: ReactNode;
	endHtmlProps?: BaseHTMLAttributes<HTMLDivElement>;
	endClassName?: string;
};

export const Navbar: FunctionComponent<
	PropsWithChildren<NavbarProps> & BaseHTMLAttributes<HTMLBaseElement>
> = (props) => {
	const {
		background,
		text,
		shadow,
		start,
		center,
		end,
		children,
		className,
		startHtmlProps,
		startClassName,
		centerHtmlProps,
		centerClassName,
		endHtmlProps,
		endClassName,
		...htmlProps
	} = props;
	return (
		<header
			className={clsx(
				"navbar",
				background,
				text,
				shadow === null ? undefined : (shadow ?? "shadow-sm"),
				className,
			)}
			{...htmlProps}
		>
			{start ? (
				<div
					className={clsx("navbar-start", startClassName)}
					{...startHtmlProps}
				>
					{start}
				</div>
			) : null}
			{center ? (
				<div
					className={clsx("navbar-center", centerClassName)}
					{...centerHtmlProps}
				>
					{center}
				</div>
			) : null}
			{end ? (
				<div className={clsx("navbar-end", endClassName)} {...endHtmlProps}>
					{end}
				</div>
			) : null}
			{children}
		</header>
	);
};
