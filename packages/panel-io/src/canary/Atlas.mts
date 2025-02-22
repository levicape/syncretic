#!/usr/bin/env -S node --no-warnings --watch

import { Atlas } from "@levicape/spork-atlas";

const { PANEL_UI, PANEL_HTTP } = process.env;

export const PanelHttp = Atlas({
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
