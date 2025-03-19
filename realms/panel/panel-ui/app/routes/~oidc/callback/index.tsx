import type { Context } from "hono";
import type { ReactElement } from "react";

export default async function Callback(_c: Context): Promise<ReactElement> {
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
