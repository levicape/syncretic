import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir as nodeTmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { normalize as normalizeWindows } from "node:path/win32";
import { debugLog } from "../Debug.mjs";
import { executeSafe, executeSync } from "../Execute.mjs";
import {
	getCommit,
	getPullRequest,
	getRepository,
	getRepositoryUrl,
} from "../code/Git.mjs";
import { getEnv } from "./Environment.mjs";
import { escapePowershell } from "./Parsing.mjs";
import { curl } from "./Process.mjs";
import { isLinux, isMacOS, isWindows } from "./System.mjs";

class PError extends Error {
	constructor(
		public message: string,
		public cause: { cause?: unknown },
	) {
		super(message);
	}
}

interface CachedFiles {
	[key: string]: string;
}

let cachedFiles: CachedFiles | undefined;
export async function getChangedFiles(
	cwd: string,
	base: string,
	head: string,
): Promise<string[] | undefined> {
	const repository = getRepository(cwd);
	let h = head;
	let b = base;
	h ||= getCommit(cwd) || "HEAD";
	b ||= `${h}^1`;

	const url = `https://api.github.com/repos/${repository}/compare/${b}...${h}`;
	const { error, body } = await curl(url, { json: true });

	if (error) {
		console.warn("Failed to list changed files:", error);
		return;
	}

	const { files } = body as {
		files: Array<{ filename: string; status: string }>;
	};
	return files
		.filter(({ status }) => !/removed|unchanged/i.test(status))
		.map(({ filename }) => filename);
}

export function readFile(
	filename: string,
	options: { cache?: boolean } = {},
): string {
	const absolutePath = resolve(filename);
	if (options.cache) {
		if (cachedFiles?.[absolutePath]) {
			return cachedFiles[absolutePath];
		}
	}

	const relativePath = relative(process.cwd(), absolutePath);
	debugLog("$", "cat", relativePath);

	let content: string;
	try {
		content = readFileSync(absolutePath, "utf-8");
	} catch (cause) {
		throw new PError(`Read failed: ${relativePath}`, { cause });
	}

	if (options.cache) {
		cachedFiles ||= {};
		cachedFiles[absolutePath] = content;
	}

	return content;
}

export async function unzip(filename: string, output: string): Promise<string> {
	const destination = output || mkdtempSync(join(tmpdir(), "unzip-"));
	if (isWindows) {
		const command = `Expand-Archive -Force -LiteralPath "${escapePowershell(filename)}" -DestinationPath "${escapePowershell(destination)}"`;
		await executeSafe(["powershell", "-Command", command]);
	} else {
		await executeSafe(["unzip", "-o", filename, "-d", destination]);
	}
	return destination;
}

export function tmpdir() {
	if (isWindows) {
		for (const key of ["TMPDIR", "TEMP", "TEMPDIR", "TMP", "RUNNER_TEMP"]) {
			const tmpdir = getEnv(key, false);
			if (
				!tmpdir ||
				/cygwin|cygdrive/i.test(tmpdir) ||
				!/^[a-z]/i.test(tmpdir)
			) {
				continue;
			}
			return normalizeWindows(tmpdir);
		}

		const appData = process.env.LOCALAPPDATA;
		if (appData) {
			const appDataTemp = join(appData, "Temp");
			if (existsSync(appDataTemp)) {
				return appDataTemp;
			}
		}
	}

	if (isMacOS || isLinux) {
		if (existsSync("/tmp")) {
			return "/tmp";
		}
	}

	return nodeTmpdir();
}

export function writeFile(
	filename: string,
	content: Uint8Array | string | Buffer,
	options: { mode?: number } = {},
) {
	const parent = dirname(filename);
	if (!existsSync(parent)) {
		mkdirSync(parent, { recursive: true });
	}

	writeFileSync(filename, content);

	if (options.mode) {
		chmodSync(filename, options.mode);
	}
}

export function getFileUrl(
	filename?: string,
	line?: number,
): URL | string | undefined {
	let cwd: string | undefined;
	if (filename?.startsWith("vendor")) {
		const parentPath = resolve(dirname(filename));
		const { error, stdout } = executeSync(
			["git", "rev-parse", "--show-toplevel"],
			{ cwd: parentPath },
		);
		if (error) {
			return;
		}
		cwd = stdout.trim();
	}

	const baseUrl = getRepositoryUrl(cwd);
	if (!filename) {
		return baseUrl;
	}

	const filePath = (cwd ? relative(cwd, filename) : filename).replace(
		/\\/g,
		"/",
	);
	const pullRequest = getPullRequest();

	if (pullRequest) {
		const fileMd5 = createHash("sha256").update(filePath).digest("hex");
		const url = new URL(
			`pull/${pullRequest}/files#diff-${fileMd5}`,
			`${baseUrl}/`,
		);
		if (typeof line !== "undefined") {
			return new URL(`R${line}`, url);
		}
		return url;
	}

	const commit = getCommit(cwd);
	const url = new URL(`blob/${commit}/${filePath}`, `${baseUrl}/`).toString();
	if (typeof line !== "undefined") {
		return new URL(`#L${line}`, url);
	}
	return url;
}
