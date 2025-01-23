import {
	HonoHttpApp,
	HonoHttpMiddlewareStandard,
} from "@levicape/spork/router/hono";

export const PanelHonoApp = async () =>
	HonoHttpApp({
		middleware: [...HonoHttpMiddlewareStandard()],
	});
