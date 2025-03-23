import clsx from "clsx";
import { type FC, type PropsWithChildren, Suspense, useMemo } from "react";
import { DesignSystem } from "./DesignSystem";
import { CaptureTouchEvents } from "./behavior/$CaptureTouchEvents";
import { HeaderLayout } from "./trim/header/HeaderLayout";

const { Shell, Layout, Fallback } = DesignSystem;

export const AppBody: FC<PropsWithChildren> = ({ children }) => (
	<body
		id="app"
		className={clsx(
			"bg-base-100",
			"min-h-screen",
			"overflow-hidden",
			"bg-gradient-to-b",
			"to-base-300",
			"bg-fixed",
			"text-base-content",
			"antialiased",
		)}
	>
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
	</body>
);
