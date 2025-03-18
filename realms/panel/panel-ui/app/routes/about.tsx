import type { Context } from "hono";

export default async function Home(_c: Context) {
	const rendered = Date.now();

	return (
		<main>
			<article className={"hidden"} suppressHydrationWarning>
				<small>{rendered}</small>
			</article>
			<article>
				<h1>About</h1>
			</article>
		</main>
	);
}
