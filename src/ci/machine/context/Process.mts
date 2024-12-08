import { debugLog } from "../Debug.mjs";
import { getGithubToken } from "../executor/GithubActions.mjs";
import { readFile, writeFile } from "./Filesystem.mjs";

interface CurlOptions {
	method?: string;
	body?: string;
	headers?: Record<string, string | undefined>;
	timeout?: number;
	retries?: number;
	json?: boolean;
	arrayBuffer?: boolean;
	filename?: string;
}

interface CurlResult {
	status: number;
	statusText: string;
	error: PError | undefined;
	body: unknown;
}
class PError extends Error {
	constructor(
		public message: string,
		public cause: { cause?: unknown },
	) {
		super(message);
	}
}

export async function curl(
	url: string | URL,
	options: CurlOptions = {},
): Promise<CurlResult> {
	const { hostname, href } = new URL(url);
	const method = options.method || "GET";
	const input = options.body;
	const headers = (options.headers || {}) as Record<string, string>;
	const retries = options.retries || 3;
	const json = options.json;
	const arrayBuffer = options.arrayBuffer;
	const filename = options.filename;

	if (typeof headers.Authorization === "undefined") {
		if (hostname === "api.github.com" || hostname === "uploads.github.com") {
			const githubToken = getGithubToken();
			if (githubToken) {
				headers.Authorization = `Bearer ${githubToken}`;
			}
		}
	}

	let status: string | number | undefined;
	let statusText: string | undefined;
	let body: unknown;
	let error: PError | undefined;
	for (let i = 0; i < retries; i++) {
		if (i > 0) {
			await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
		}

		let response: Response;
		try {
			response = await fetch(href, { method, headers, body: input });
		} catch (cause) {
			debugLog("$", "curl", href, "-> error");
			error = new PError(`Fetch failed: ${method} ${url}`, { cause });
			continue;
		}

		status = response.status;
		statusText = response.statusText;
		debugLog("$", "curl", href, "->", status.toString(), statusText);

		const ok = response.ok;
		try {
			if (filename && ok) {
				const buffer = await response.arrayBuffer();
				writeFile(filename, new Uint8Array(buffer));
			} else if (arrayBuffer && ok) {
				body = await response.arrayBuffer();
			} else if (json && ok) {
				body = await response.json();
			} else {
				body = await response.text();
			}
		} catch (cause) {
			error = new PError(`Fetch failed: ${method} ${url}`, { cause });
			continue;
		}

		if (response.ok) {
			break;
		}

		error = new PError(
			`Fetch failed: ${method} ${url}: ${status} ${statusText}`,
			{ cause: body },
		);

		if (status === 400 || status === 404 || status === 422) {
			break;
		}
	}

	return {
		status: status as number,
		statusText: statusText as string,
		error,
		body,
	};
}

export async function curlSafe(
	url: string,
	options: CurlOptions,
): Promise<unknown> {
	const result = await curl(url, options);

	const { error, body } = result;
	if (error) {
		throw error;
	}

	return body;
}

export function getWindowsExitReason(exitCode: number): string | undefined {
	const ntStatusPath =
		"C:\\Program Files (x86)\\Windows Kits\\10\\Include\\10.0.22621.0\\shared\\ntstatus.h";
	const nthStatus = readFile(ntStatusPath, { cache: true });

	const match = nthStatus.match(
		new RegExp(`(STATUS_\\w+).*0x${exitCode?.toString(16)}`, "i"),
	);
	if (match) {
		const [, exitReason] = match;
		return exitReason;
	}

	return;
}
