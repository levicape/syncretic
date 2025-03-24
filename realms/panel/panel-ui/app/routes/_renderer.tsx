import { reactRenderer } from "@hono/react-renderer";
import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { AppBody } from "../ui/AppBody";
import { ApplicationHead } from "../ui/DesignSystem";

const foafStyle: React.CSSProperties = {
	display: "none",
	pointerEvents: "none",
	touchAction: "none",
	position: "fixed",
	visibility: "hidden",
	width: 0,
	height: 0,
	top: 0,
	left: 0,
	zIndex: -1,
};

export default reactRenderer(({ children }: PropsWithChildren) => {
	return (
		<html className={clsx("overflow-x-hidden", "overscroll-contain")} lang="en">
			{/* <!-- Root --> */}
			<head>
				{/* <!-- Head --> */}
				<title>{ApplicationHead.title.default}</title>
				<meta name="description" content={ApplicationHead.description} />
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="icon" href={"/favicon.ico"} type="image/png" />
				<script type="module" src="/_window/oidc.js" />
				{import.meta.env.PROD ? (
					<>
						<script type="module" src="/!/!!/render.js" defer />
						<link href="/!/!!/_a/style.css" rel="stylesheet" />
					</>
				) : (
					<>
						<script type="module" src="/app/render.ts" defer />
						<link href="/app/style.css" rel="stylesheet" />
					</>
				)}
			</head>
			<AppBody>
				{/* <!-- Body --> */}
				{children}
			</AppBody>
			<object
				suppressHydrationWarning
				typeof="foaf:Document"
				style={foafStyle}
				aria-hidden
				data-base-uri={ApplicationHead.metadataBase?.href}
				data-meta-base-url={import.meta.env.BASE_URL}
				data-open-graph-url={ApplicationHead.openGraph.url}
				data-rendered={new Date().toISOString()}
			/>
		</html>
	);
});
