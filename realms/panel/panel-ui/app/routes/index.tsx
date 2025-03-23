import { clsx } from "clsx";
import type { Context } from "hono";
import { LoginButton } from "../islands/authentication/$LoginButton";
import { App } from "./index/$App";

export default async function Home(_c: Context) {
	return (
		<main className={clsx("pt-40", "text-center")}>
			<article className={"hero-content"}>
				<LoginButton />
			</article>
			<App />
		</main>
	);
}
