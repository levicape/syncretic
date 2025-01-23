import { HonoHttpServerBuilder } from "@levicape/spork/router/hono";
import { PanelHonoApp } from "../app/PanelHonoApp.mjs";

export default HonoHttpServerBuilder({
	app: await PanelHonoApp(),
});
