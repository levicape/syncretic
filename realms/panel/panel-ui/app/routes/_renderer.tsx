import { reactRenderer } from "@hono/react-renderer";
import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { AppBody } from "../ui/AppBody";
import { ApplicationHead } from "../ui/DesignSystem";

export default reactRenderer(({ children }: PropsWithChildren) => {
	return (
		<html className={clsx("overflow-x-hidden", "overscroll-contain")} lang="en">
			{/* <!-- React-Helmet-Async-SSR --> */}
			<head>
				<title>{ApplicationHead.title.default}</title>
				<meta name="description" content={ApplicationHead.description} />
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="icon" href={"/favicon.ico"} type="image/png" />
				{import.meta.env.PROD ? (
					<>
						<script type="module" src="/static/render.js" />
						<link href="/static/assets/style.css" rel="stylesheet" />
					</>
				) : (
					<>
						<script type="module" src="/app/render.ts" />
						<link href="/app/style.css" rel="stylesheet" />
					</>
				)}
			</head>
			<AppBody>{children}</AppBody>
		</html>
	);
});
