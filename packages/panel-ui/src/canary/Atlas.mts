#!/usr/bin/env -S node --no-warnings --watch

import { Atlas } from "@levicape/spork-atlas";

const { PANEL_HTTP, PANEL_UI } = process.env;

// Import from -io?
export const PanelWeb = Atlas({
	"/": {
		$kind: "ComposeRouteResource",
		hostname: `ui:${PANEL_UI}`,
		protocol: "http",
	},
	"/~/v1/Fourtwo/Panel": {
		$kind: "ComposeRouteResource",
		hostname: `http:${PANEL_HTTP}`,
		protocol: "http",
	},
});
