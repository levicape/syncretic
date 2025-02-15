import { SporkHonoHttpServer } from "@levicape/spork/hono";
import { Hono } from "hono";

export const { server, handler } = await SporkHonoHttpServer((app) =>
	app.route(
		"/",
		app.get(async (c) => c.json({ message: `Hello, ${Hono.name}!` })),
	),
);
