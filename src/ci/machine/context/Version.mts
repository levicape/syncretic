import { existsSync } from "node:fs";
import { executeSync } from "../Execute.mjs";
import { readFile } from "./Filesystem.mjs";
import { isLinux, isMacOS, isWindows } from "./System.mjs";

export function getDistro(): string | undefined {
	if (isMacOS) {
		return "macOS";
	}

	if (isLinux) {
		const alpinePath = "/etc/alpine-release";
		if (existsSync(alpinePath)) {
			return "alpine";
		}

		const releasePath = "/etc/os-release";
		if (existsSync(releasePath)) {
			const releaseFile = readFile(releasePath, { cache: true });
			const match = releaseFile.match(/^ID=\"?(.*)\"?/m);
			if (match) {
				return match[1];
			}
		}

		const { error, stdout } = executeSync(["lsb_release", "-is"]);
		if (!error) {
			return stdout.trim().toLowerCase();
		}
	}

	if (isWindows) {
		const { error, stdout } = executeSync(["cmd", "/c", "ver"]);
		if (!error) {
			return stdout.trim();
		}
	}

	return;
}

export function getDistroVersion(): string | undefined {
	if (isMacOS) {
		const { error, stdout } = executeSync(["sw_vers", "-productVersion"]);
		if (!error) {
			return stdout.trim();
		}
	}

	if (isLinux) {
		const alpinePath = "/etc/alpine-release";
		if (existsSync(alpinePath)) {
			const release = readFile(alpinePath, { cache: true }).trim();
			if (release.includes("_")) {
				const [version] = release.split("_");
				return `${version}-edge`;
			}
			return release;
		}

		const releasePath = "/etc/os-release";
		if (existsSync(releasePath)) {
			const releaseFile = readFile(releasePath, { cache: true });
			const match = releaseFile.match(/^VERSION_ID=\"?(.*)\"?/m);
			if (match) {
				return match[1];
			}
		}

		const { error, stdout } = executeSync(["lsb_release", "-rs"]);
		if (!error) {
			return stdout.trim();
		}
	}

	if (isWindows) {
		const { error, stdout } = executeSync(["cmd", "/c", "ver"]);
		if (!error) {
			return stdout.trim();
		}
	}

	return;
}
