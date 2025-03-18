import type { Context } from "hono";
import { MagmapAtlas } from "./$MagmapAtlas";

export default async function Principals(_c: Context) {
	return (
		<main className="hero">
			<article className={"hero-content"}>
				<div className="join join-vertical gap-4">
					<h2 className={"join-item"}>{"Atlasfile"}</h2>
					<MagmapAtlas />
				</div>
			</article>
		</main>
	);
}
