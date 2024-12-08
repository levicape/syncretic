import { existsSync } from "node:fs";
import { executeSync } from "../Execute.mjs";
import { isMacOS } from "../context/System.mjs";

export function getTailscale() {
	if (isMacOS) {
		const tailscaleApp = "/Applications/Tailscale.app/Contents/MacOS/tailscale";
		if (existsSync(tailscaleApp)) {
			return tailscaleApp;
		}
	}

	return "tailscale";
}

export function getTailscaleIp() {
	const tailscale = getTailscale();
	const { error, stdout } = executeSync([tailscale, "ip", "--1"]);
	if (!error) {
		return stdout.trim();
	}

	return;
}
