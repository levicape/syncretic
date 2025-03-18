import type { ErrorHandler } from "hono";
import { SUSPENSE_GUARD } from "../ui/Client";

const handler: ErrorHandler = (e, c) => {
	if ("getResponse" in e) {
		return e.getResponse();
	}
	if (e.message !== SUSPENSE_GUARD) {
		console.trace(e.message);
		c.status(500);
		return c.render(
			<>
				<h1>Internal Server Error</h1>
				<p>Something went wrong. Please try again later.</p>
			</>,
		);
	}

	// biome-ignore lint/complexity/noUselessFragments:
	return c.render(<></>);
};

export default handler;
