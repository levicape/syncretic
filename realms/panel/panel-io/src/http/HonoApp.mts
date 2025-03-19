import { SporkHonoHttpServer } from "@levicape/spork/router/hono/HonoHttpServerBuilder";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { HTTP_ROOT_PATH } from "../Atlas.mjs";

export const { server, handler, stream } = await SporkHonoHttpServer((app) =>
	app
		.basePath(HTTP_ROOT_PATH)
		.get("/Principal", async (c) => {
			return c.json({ message: `Hello, ${Hono.name}!` });
		})
		.get("/AnotherEndpoint", async (_c) => {
			throw new HTTPException(400, {
				res: new Response(
					JSON.stringify({
						error: "Hello, Hono!",
					}),
				),
			});
		}),
);

export type PanelHonoApp = typeof server.app;
