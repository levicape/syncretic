import type { Context } from "hono";
import { App } from "./index/$App";

export default async function Home(_c: Context) {
	return (
		<main className="hero">
			<App />
		</main>
	);
}
