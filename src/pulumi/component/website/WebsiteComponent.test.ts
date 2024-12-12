import { execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Mock, beforeEach, describe, it, mock } from "node:test";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { expect } from "expect";
import { hashElement } from "folder-hash";
import type { Context } from "../../../context/Context.js";
import {
	WebsiteComponent,
	type WebsiteComponentBuildProps,
} from "./WebsiteComponent.js";

mock.module("child_process");
mock.module("fs");

mock.module("folder-hash", {
	namedExports: {
		hashElement: mock.fn(() => ({ hash: "some_hash" })),
	},
});

mock.module("@pulumi/pulumi/runtime/index.js", {
	namedExports: {
		isDryRun: mock.fn(() => undefined),
	},
});

const execSyncMock = execSync as Mock<typeof execSync>;
const cpSyncMock = cpSync as Mock<typeof cpSync>;
const mkdirSyncMock = mkdirSync as Mock<typeof mkdirSync>;
const writeFileSyncMock = writeFileSync as Mock<typeof writeFileSync>;
const hashElementMock = hashElement as Mock<typeof hashElement>;
const isDryRunMock = isDryRun as Mock<typeof isDryRun>;

describe("WebsiteComponent", () => {
	const context: Context = {
		stage: "test",
		prefix: "TEST-",
		environment: {
			isProd: false,
			features: ["aws"],
		},
	};

	beforeEach(() => {
		mock.restoreAll();

		hashElementMock.mock.mockImplementation(async (...props: unknown[]) => ({
			hash: "some_id",
			name: "",
			children: [],
		}));
		isDryRunMock.mock.mockImplementation(() => true);
	});

	it("should build correctly with Docker", async () => {
		const props: WebsiteComponentBuildProps = {
			root: "../src",
			copyFrom: "build",
			indexHtmlPath: "index.html",
			errorHtmlPath: "error.html",
			useDocker: true,
		};

		// @ts-ignore
		execSyncMock.mock.mockImplementation((cmd: string, ...props: unknown[]) => {
			if (cmd.startsWith("docker build")) {
				return Buffer.from("Docker image built");
			}
			if (cmd.startsWith("docker run")) {
				return Buffer.from("Docker run complete");
			}
			throw new Error(`Unexpected command: ${cmd}`);
		});

		// Call build method
		const result = await WebsiteComponent.build(context, props);

		expect(result.wwwroot).toBeDefined();
		expect(result.indexHtmlPath).toBe(props.indexHtmlPath);
		expect(result.errorHtmlPath).toBe(props.errorHtmlPath);
		expect(execSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("docker build"),
			{ stdio: "inherit" },
		);
		expect(execSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("docker run"),
			{ stdio: "inherit" },
		);
	});

	it("should build correctly with Shell", async () => {
		const props: WebsiteComponentBuildProps = {
			root: "../src",
			copyFrom: "build",
			indexHtmlPath: "index.html",
			errorHtmlPath: "error.html",
			useDocker: false,
		};

		// @ts-ignore
		execSyncMock.mock.mockImplementation((cmd: string) => {
			if (cmd.includes("npm install")) {
				return "Dependencies installed";
			}
			if (cmd.includes("npm run build")) {
				return "Build complete";
			}
			if (cmd.includes("pwd;")) {
				return "Directory checked";
			}
			if (cmd.includes("cd")) {
				return "Directory move";
			}
			throw new Error(`Unexpected command: ${cmd}`);
		});

		// Mock file system operations
		mkdirSyncMock.mock.mockImplementation(() => {
			return undefined;
		});
		cpSyncMock.mock.mockImplementation(() => {});

		// Call build method
		const result = await WebsiteComponent.build(context, props);

		expect(result.wwwroot).toBeDefined();
		expect(result.indexHtmlPath).toBe(props.indexHtmlPath);
		expect(result.errorHtmlPath).toBe(props.errorHtmlPath);
		expect(execSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("npm install"),
			{ encoding: "ascii" },
		);
		expect(execSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("npm run build"),
			{ encoding: "ascii" },
		);
	});

	it("should throw an error if build fails", async () => {
		const props: WebsiteComponentBuildProps = {
			root: "../src",
			copyFrom: "build",
			indexHtmlPath: "index.html",
			errorHtmlPath: "error.html",
			useDocker: false,
		};

		execSyncMock.mock.mockImplementation(() => {
			throw new Error("Build error");
		});

		await expect(WebsiteComponent.build(context, props)).rejects.toThrow(
			"Build error",
		);
	});

	it("should handle Dockerfile creation", () => {
		const dockerfilePath = path.join("path", "to", "dir", "Dockerfile");
		const dockerfileContent = `
      FROM node:20
      WORKDIR /app
      COPY package*.json ./
      RUN npm install
      COPY . .
      RUN npm run build
    `;

		writeFileSyncMock.mock.mockImplementation(() => {});
		WebsiteComponent.buildWithDocker(
			"path/to/dir",
			"path/to/copy",
			"build",
			"index.html",
			"error.html",
		);

		expect(writeFileSyncMock).toHaveBeenCalledWith(
			dockerfilePath,
			dockerfileContent,
		);
	});
});
