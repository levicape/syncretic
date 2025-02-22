import { SporkHonoHttpServer } from "@levicape/spork/hono";
import { Hono } from "hono";

export const { server, handler } = await SporkHonoHttpServer((app) =>
	app.basePath("/~/v1/Fourtwo/Panel").get("/ok", async (c) => {
		return c.json({ message: `Hello, ${Hono.name}!` });
	}),
);

export type PanelHonoApp = typeof server.app;
