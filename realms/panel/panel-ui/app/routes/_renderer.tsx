import { reactRenderer } from "@hono/react-renderer";
import { AppBody } from "../ui/AppBody";

export default reactRenderer(({ children }) => {
	return (
		<html data-theme="dark" lang="en">
			{/* <!-- React-Helmet-Async-SSR --> */}
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />

				{import.meta.env.PROD ? (
					<>
						<script type="module" src="/static/client.js" />
						<link href="/static/assets/style.css" rel="stylesheet" />
					</>
				) : (
					<>
						<script type="module" src="/app/client.ts" />
						<link href="/app/style.css" rel="stylesheet" />
					</>
				)}
			</head>
			<AppBody>{children}</AppBody>
		</html>
	);
});
