import { existsSync } from "node:fs";
import { release } from "node:os";
import type { Target } from "../../cd/target/Target.mjs";
import { executeSync } from "../Execute.mjs";

export const isWindows = process.platform === "win32";
export const isMacOS = process.platform === "darwin";
export const isLinux = process.platform === "linux";
export const isPosix = isMacOS || isLinux;

export function parseOs(string: string): "darwin" | "linux" | "windows" {
	if (/darwin|apple|mac/i.test(string)) {
		return "darwin";
	}
	if (/linux/i.test(string)) {
		return "linux";
	}
	if (/win/i.test(string)) {
		return "windows";
	}
	throw new Error(`Unsupported operating system: ${string}`);
}

export function getOs(): "darwin" | "linux" | "windows" {
	return parseOs(process.platform);
}

export function parseArch(string: string): "x64" | "aarch64" {
	if (/x64|amd64|x86_64/i.test(string)) {
		return "x64";
	}
	if (/arm64|aarch64/i.test(string)) {
		return "aarch64";
	}
	throw new Error(`Unsupported architecture: ${string}`);
}

export function getArch(): "x64" | "aarch64" {
	return parseArch(process.arch);
}

export function getKernel(): string {
	const kernel = release();
	const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(kernel);

	if (match) {
		const [, major, minor, patch] = match;
		if (patch) {
			return `${major}.${minor}.${patch}`;
		}
		return `${major}.${minor}`;
	}

	return kernel;
}

export function getAbi(): "musl" | "gnu" | undefined {
	if (!isLinux) {
		return;
	}

	if (existsSync("/etc/alpine-release")) {
		return "musl";
	}

	const arch = getArch() === "x64" ? "x86_64" : "aarch64";
	const muslLibPath = `/lib/ld-musl-${arch}.so.1`;
	if (existsSync(muslLibPath)) {
		return "musl";
	}

	const gnuLibPath = `/lib/ld-linux-${arch}.so.2`;
	if (existsSync(gnuLibPath)) {
		return "gnu";
	}

	const { error, stdout } = executeSync(["ldd", "--version"]);
	if (!error) {
		if (/musl/i.test(stdout)) {
			return "musl";
		}
		if (/gnu|glibc/i.test(stdout)) {
			return "gnu";
		}
	}

	return;
}

export function getAbiVersion(): string | undefined {
	if (!isLinux) {
		return;
	}

	const { error, stdout } = executeSync(["ldd", "--version"]);
	if (!error) {
		const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(stdout);
		if (match) {
			const [, major, minor, patch] = match;
			if (patch) {
				return `${major}.${minor}.${patch}`;
			}
			return `${major}.${minor}`;
		}
	}

	return;
}

export const parseTarget = (
	string: string,
): Target & { label: string; profile: boolean } => {
	const os = parseOs(string);
	const arch = parseArch(string);
	const abi = os === "linux" && string.includes("-musl") ? "musl" : undefined;
	const baseline = arch === "x64" ? string.includes("-baseline") : undefined;
	const profile = string.includes("-profile");

	let label = `${os}-${arch}`;
	if (abi) {
		label += `-${abi}`;
	}
	if (baseline) {
		label += "-baseline";
	}
	if (profile) {
		label += "-profile";
	}

	return { label, os, arch, abi, baseline, profile };
};
