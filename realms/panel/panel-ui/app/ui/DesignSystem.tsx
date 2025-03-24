import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { process } from "std-env";

const ApplicationName = "Panel";
export const ApplicationHead = {
	title: {
		template: `%s | ${ApplicationName}`,
		default: ApplicationName,
	},
	description:
		"Panel is a web-based user interface for viewing a Fourtwo principal's configuration and state.",
	metadataBase:
		(process?.env.URL !== undefined && new URL(process.env.URL)) || undefined,
	openGraph: {
		type: "website",
		title: ApplicationName,
		url: process.env.URL,
		images: [`${process.env.URL}/static/social/splash.png`],
	},
} as const;

export type DesignSystemProps = {
	id?: string;
	className?: string;
};

export const DesignSystemComponents = {
	Shell: "Shell",
	ShellBackground: "ShellBackground",
	Header: "Header",
	Menubar: "Menubar",
	Commandline: "Commandline",
	Layout: "Layout",
	Footer: "Footer",
};
export type DesignSystemId =
	(typeof DesignSystemComponents)[keyof typeof DesignSystemComponents];
/**
 * DesignSystem is a namespace that contains normalized components that wrap the app markup
 */
export namespace DesignSystem {
	/**
	 * css: body > Shell
	 */
	export function Shell({
		children,
		className,
	}: PropsWithChildren<{ className?: string }>) {
		return (
			<div
				id={DesignSystemComponents.Shell}
				className={clsx(
					"bg-base-100",
					"overflow-hidden",
					"min-h-screen",
					"bg-fixed",
					"text-base-content",
					className,
				)}
			>
				{children}
			</div>
		);
	}
	/**
	 * css: Shell > #ShellBackground
	 */
	export function ShellBackground() {
		return (
			<div
				id={DesignSystemComponents.ShellBackground}
				aria-hidden
				className={clsx(
					"absolute",
					"w-full",
					"h-full",
					"bg-neutral/10",
					"to-accent/25",
					"bg-gradient-to-b",
					"opacity-15",
				)}
			>
				<div
					aria-hidden
					className={clsx(
						"w-full",
						"h-full",
						"bg-primary/15",
						"to-neutral/70",
						"bg-gradient-to-t",
						"blur-xl",
						"dark:mix-blend-color-dodge",
						"light:mix-blend-color-burn",
					)}
				/>
			</div>
		);
	}
	/**
	 * css: Shell > #Header
	 */
	export function Header({
		children,
		id,
		className,
	}: PropsWithChildren<DesignSystemProps>) {
		return (
			<header
				id={id ?? DesignSystemComponents.Header}
				className={clsx("text-2xl", "font-bold", className)}
			>
				{children}
			</header>
		);
	}
	/**
	 * css: Shell > #Header > #Commandline
	 */
	export function Commandline({ id, className }: DesignSystemProps) {
		return (
			<span
				id={id ?? DesignSystemComponents.Commandline}
				className={className}
			/>
		);
	}
	/**
	 * css: Shell > #Menubar
	 */
	export function Menubar({
		children,
		id,
		className,
	}: PropsWithChildren<DesignSystemProps>) {
		return (
			<nav id={id ?? DesignSystemComponents.Menubar} className={className}>
				{children}
			</nav>
		);
	}

	/**
	 * Fallback is a component used for suspense fallback rendering
	 * css: Shell > #Fallback
	 */
	export function Fallback() {
		return (
			<div
				className={clsx(
					"w-20",
					"h-20",
					"loading-spinner",
					"absolute",
					"top-1/2",
					"left-1/2",
					"-translate-x-1/2",
					"-translate-y-1/2",
					"z-20",
					"bg-ironstone-300",
					"border-8",
					"border-ironstone-500",
					"rounded-full",
					"animate-spin",
					"duration-500",
					"ease-in-out",
					"delay-150",
					"transform",
					"origin-center",
					"shadow-lg",
					"shadow-ironstone-500/50",
					"backdrop-blur-sm",
					"backdrop-brightness-50",
					"backdrop-saturate-50",
					"backdrop-hue-rotate-0",
					"backdrop-blend-normal",
					"backdrop-filter",
					"backdrop-opacity-90",
				)}
			/>
		);
	}

	/**
	 * Layout is a sibling of the Header and Menubar components
	 * css: Shell > Layout
	 */
	export function Layout({ children }: PropsWithChildren) {
		return (
			<div
				id={DesignSystemComponents.Layout}
				className={clsx(
					"antialiased",
					"min-h-50",
					"bg-base-200/30",
					"md:rounded-4xl",
					"bg-gradient-to-t",
					"from-base-100/80",
					"to-base-200/20",
				)}
			>
				{children}
			</div>
		);
	}

	/**
	 * css: #Shell > #Footer
	 */
	export function Footer({
		children,
		id,
		className,
	}: PropsWithChildren<DesignSystemProps>) {
		return (
			<footer id={id ?? DesignSystemComponents.Footer} className={className}>
				{children}
			</footer>
		);
	}
}
