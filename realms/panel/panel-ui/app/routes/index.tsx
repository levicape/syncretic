import { clsx } from "clsx";
import type { Context } from "hono";
import { App } from "./index/$App";

export default async function Home(_c: Context) {
	return (
		<main className={clsx("hero", "pt-40", "text-center")}>
			<article className={"hero-content"}>
				<App />
			</article>
		</main>
	);
}
