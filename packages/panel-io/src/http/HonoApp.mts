import { SporkHonoHttpServer } from "@levicape/spork/hono";
import { Hono } from "hono";
import { HTTP_ROOT_PATH } from "./Atlas.mjs";

export const { server, handler } = await SporkHonoHttpServer((app) =>
	app.basePath(HTTP_ROOT_PATH).get("/ok", async (c) => {
		return c.json({ message: `Hello, ${Hono.name}!` });
	}),
);

export type PanelHonoApp = typeof server.app;
