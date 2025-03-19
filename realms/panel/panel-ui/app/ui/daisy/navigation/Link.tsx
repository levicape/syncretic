import { clsx } from "clsx";

export type DaisyLinkVariant = "hover";

export type DaisyLinkColor =
	| "neutral"
	| "primary"
	| "secondary"
	| "accent"
	| "info"
	| "success"
	| "warning"
	| "error";

export type LinkProps = {
	color?: DaisyLinkColor;
	className?: string;
} & {
	[variant in DaisyLinkVariant]?: true;
};

export const Link = (
	props: {
		href: string;
	} & React.AnchorHTMLAttributes<HTMLAnchorElement> &
		LinkProps,
) => {
	const { href, color, children, className, ...aprops } = props;
	return (
		<a
			href={href}
			className={clsx(
				"link",
				color ? `link-${color}` : "link-primary",
				className,
			)}
			{...aprops}
		>
			{children}
		</a>
	);
};
