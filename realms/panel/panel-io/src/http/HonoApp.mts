import { SporkHonoHttpServer } from "@levicape/spork/router/hono/HonoHttpServerBuilder";
import type { HonoException } from "@levicape/spork/router/hono/middleware/exception/HonoExceptionMiddleware";
import { Hono } from "hono";
import { HTTP_ROOT_PATH } from "../Atlas.mjs";

export const { server, handler, stream } = await SporkHonoHttpServer((app) =>
	app
		.basePath(HTTP_ROOT_PATH)
		.get("/Principal", async (c) => {
			return c.json({ message: `Hello, ${Hono.name}!` });
		})
		.get("/AnotherEndpoint", async (_c) => {
			throw {
				code: "AnotherEndpointError",
				message: "This is another endpoint error!",
				cause: null,
				validations: [],
				unrecoverable: false,
			} as HonoException;
		}),
);

export type PanelHonoApp = typeof server.app;
