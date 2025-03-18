import clsx from "clsx";
import { type FC, type PropsWithChildren, Suspense } from "react";
// import { Router } from "../routes/index/$AtomicRouter";
import { DesignSystem } from "./DesignSystem";

const { Shell, Header, Menubar, Layout, Fallback } = DesignSystem;
const HeaderRoot: FC<PropsWithChildren> = ({ children }) => (
	<>
		<Header
			className={clsx(
				"flex",
				"w-full",
				"px-4",
				"py-2",
				"m-0",
				"bg-ironstone-300",
				"border-b-8",
				"border-ironstone-500",
			)}
			id="Header"
		>
			<h1 className={clsx("text-xl", "py-0", "px-2", "text-amber-100")}>
				MagMap
			</h1>
			<Menubar
				className={clsx(
					"absolute",
					"right-0",
					"top-0",
					"z-10",
					"flex",
					"gap-4",
					"px-4",
					"py-2",
				)}
			>
				<ul className={clsx("flex", "gap-4")}>
					<li>
						<a href="/">Home</a>
					</li>
					<li>
						<a href="/about">About</a>
					</li>
				</ul>
			</Menubar>
		</Header>
		<Suspense fallback={<Fallback />}>
			<Layout>{children}</Layout>
		</Suspense>
	</>
);

export const AppBody: FC<PropsWithChildren> = ({ children }) => (
	<body id="app">
		<Shell>
			<HeaderRoot>{children}</HeaderRoot>
		</Shell>
		{/* <Router /> */}
	</body>
);
