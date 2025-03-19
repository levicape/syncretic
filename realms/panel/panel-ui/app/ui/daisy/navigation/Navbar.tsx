import clsx from "clsx";
import type { FunctionComponent, PropsWithChildren, ReactNode } from "react";

export type NavbarProps = {
	className?: string;
	background?: `bg-${string}`;
	text?: `text-${string}`;
	shadow?: `shadow-${string}` | null;
	start?: ReactNode;
	center?: ReactNode;
	end?: ReactNode;
};

export const Navbar: FunctionComponent<PropsWithChildren<NavbarProps>> = (
	props,
) => {
	const { background, text, shadow, start, center, end, children, className } =
		props;
	return (
		<header
			className={clsx(
				"navbar",
				background,
				text,
				shadow ? (shadow === null ? "" : shadow) : "shadow-sm",
				className,
			)}
		>
			{start ? <div className={"navbar-start"}>{start}</div> : null}
			{center ? <div className={"navbar-center"}>{center}</div> : null}
			{end ? <div className={"navbar-end"}>{end}</div> : null}
			{children}
		</header>
	);
};
