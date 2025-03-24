import clsx from "clsx";
import { type FC, type PropsWithChildren, Suspense, useMemo } from "react";
import { AuthnSession } from "../atoms/authentication/behavior/$AuthnSession";
import { DesignSystem } from "./DesignSystem";
import { CaptureTouchEvents } from "./behavior/$CaptureTouchEvents";
import { HeaderLayout } from "./trim/header/HeaderLayout";

const { Shell, Layout, Fallback } = DesignSystem;

export const AppBody: FC<PropsWithChildren> = ({ children }) => (
	<body
		id="app"
		className={clsx(
			"bg-base-100",
			"overflow-hidden",
			"min-h-screen",
			"bg-fixed",
			"text-base-content",
			"antialiased",
			"background-body",
		)}
	>
		<div
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
		<Shell>
			<HeaderLayout
				vars={useMemo(
					() => ({
						appHeight: "--app-height",
					}),
					[],
				)}
			>
				<Suspense fallback={<Fallback />}>
					<Layout>{children}</Layout>
				</Suspense>
			</HeaderLayout>
		</Shell>
		<CaptureTouchEvents />
		<AuthnSession />
		<style scoped>{`
			@media (prefers-color-scheme:light) {
				.background-body {
					background-image: url("/-decor/crossword.png");
				}			
			}

			@media (prefers-color-scheme:dark) {
				.background-body {
					background-image: url("/-decor/twinkle_twinkle.png");
				}			
			}`}</style>
	</body>
);
