#!/usr/bin/env -S node --no-warnings --watch

import { Atlas } from "@levicape/spork-atlas";
import { env } from "std-env";

const { PANEL_UI, PANEL_HTTP } = env;

export const HTTP_ROOT_PATH = "/~/Fourtwo/Panel";
export const PanelHttp = Atlas.routes({
	"/": {
		$kind: "StaticRouteResource",
		hostname: `ui:${PANEL_UI}`,
		protocol: "http",
	},
	[HTTP_ROOT_PATH]: {
		$kind: "StaticRouteResource",
		hostname: `http:${PANEL_HTTP}`,
		protocol: "http",
	},
});
