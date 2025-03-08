#!/usr/bin/env -S node --no-warnings --watch

import { Atlas } from "@levicape/spork-atlas";

const { PANEL_HTTP, PANEL_UI } = process.env;

// Import from -io?
export const PanelWeb = Atlas.routes({
	"/": {
		$kind: "StaticRouteResource",
		hostname: `ui:${PANEL_UI}`,
		protocol: "http",
	},
	"/~/Fourtwo/Panel": {
		$kind: "StaticRouteResource",
		hostname: `http:${PANEL_HTTP}`,
		protocol: "http",
	},
});
