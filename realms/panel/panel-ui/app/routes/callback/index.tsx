import type { Context } from "hono";

export default async function Callback(_c: Context) {
	return (
		<main className="hero">
			<article className={"hero-content"}>
				<div className="join join-vertical gap-4">
					<h2 className={"join-item"}>{"Atlasfile"}</h2>
				</div>
			</article>
		</main>
	);
}
