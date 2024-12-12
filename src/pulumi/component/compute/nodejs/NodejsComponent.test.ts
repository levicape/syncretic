import { execSync } from "node:child_process";
import { cpSync } from "node:fs";
import path from "node:path";
import test, { beforeEach, describe, type Mock, mock } from "node:test";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { expect } from "expect";
import { hashElement } from "folder-hash";
import type { Context } from "../../../../context/Context.js";
import type {
	ProtocolComponentBuildResult,
	ProtocolMap,
} from "../protocol/ProtocolComponent.js";
import {
	NodejsComponent,
	type NodejsComponentBuildProps,
} from "./NodejsComponent.js";

mock.module("node:child_process", {
	namedExports: {
		execSync: mock.fn(),
	},
});
mock.module("node:fs", {
	namedExports: {
		cpSync: mock.fn(),
		mkdirSync: mock.fn(),
		existsSync: mock.fn(),
		writeFileSync: mock.fn(),
	},
});
mock.module("@pulumi/pulumi/runtime/index.js", {
	namedExports: {
		isDryRun: mock.fn(),
	},
});
mock.module("folder-hash", {
	namedExports: {
		hashElement: mock.fn(),
	},
});

describe("NodejsComponent", () => {
	const mockContext: Context = {
		environment: {
			isProd: true,
			features: ["aws"],
		},
		stage: "dev",
		prefix: "prefix",
	};
	const repoRoot = "/path/to/repo";
	const tempDir = "/path/to/temp";
	const srcDir = "src";

	const protocols: ProtocolMap<
		"tarrasq" | "game",
		ProtocolComponentBuildResult
	> = {
		tarrasq: {
			root: "/path/to/tarrasq/build",
			buildId: "tarrasq-build-id",
			protocolDir: "tarrasq",
		},
		game: {
			root: "/path/to/game/build",
			buildId: "game-build-id",
			protocolDir: "game",
		},
	};

	const buildProps: NodejsComponentBuildProps<typeof protocols> = {
		command: "npm run build",
		copyFrom: { local: { path: `${repoRoot}/compute/nodejs` } },
		executor: "SHELL",
		envs: { NODE_ENV: "production" },
		nodeVersion: "14",
		artifact: "build",
		srcRoot: "src",
		protocols,
	};

	beforeEach(() => {
		mock.restoreAll();
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
	});

	test("should get source identifier correctly", async () => {
		(hashElement as Mock<typeof hashElement>).mock.mockImplementation(
			async (...props: unknown[]) => ({
				hash: "mocked-hash",
				name: "",
				children: [],
			}),
		);

		const identifier = await NodejsComponent.getSourceIdentifier(
			buildProps.copyFrom,
		);
		expect(identifier).toBe("mocked-hash");
	});

	test("should throw error for invalid executor", async () => {
		const invalidProps = { ...buildProps, executor: "INVALID" };
		await expect(
			NodejsComponent.build(
				mockContext,
				invalidProps as NodejsComponentBuildProps<typeof protocols>,
			),
		).rejects.toThrow("Invalid executor specified.");
	});

	test("should handle local source correctly", async () => {
		await NodejsComponent.handleSource(buildProps.copyFrom, tempDir);
		expect(cpSync).toHaveBeenCalledWith(
			`${repoRoot}/compute/nodejs`,
			path.join(tempDir),
			{ recursive: true },
		);
	});

	test("should handle git source correctly", async () => {
		const gitProps = {
			...buildProps,
			copyFrom: {
				git: { url: "https://github.com/repo.git", branch: "my-branch" },
			},
		};

		await NodejsComponent.handleSource(gitProps.copyFrom, tempDir);
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining(
				`git clone --branch ${gitProps.copyFrom.git.branch} https://github.com/repo.git ${path.join(tempDir)}`,
			),
			expect.any(Object),
		);
	});

	test("should build with shell executor", async () => {
		await NodejsComponent.build(mockContext, buildProps);
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("npm run build"),
			expect.any(Object),
		);
		expect(cpSync).toHaveBeenCalledWith(
			expect.stringContaining(`${repoRoot}/compute/nodejs`),
			expect.stringContaining(repoRoot.replaceAll("/", "_")),
			{ recursive: true },
		);
	});

	test("should build with docker executor", async () => {
		const dockerProps = { ...buildProps, executor: "DOCKER" as const };
		await NodejsComponent.build(mockContext, dockerProps);
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("docker build -t nodejs-build"),
			expect.any(Object),
		);
		expect(cpSync).toHaveBeenCalledWith(
			expect.stringContaining(`${repoRoot}/compute/nodejs`),
			expect.stringContaining(repoRoot.replaceAll("/", "_")),
			{ recursive: true },
		);
	});

	test("should handle dry run correctly", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => false);

		await NodejsComponent.build(mockContext, buildProps);
		expect(execSync).not.toHaveBeenCalled();
		expect(cpSync).not.toHaveBeenCalled();
	});

	test("should copy protocols map correctly", async () => {
		const original = NodejsComponent.copyProtocolInto;
		try {
			NodejsComponent.copyProtocolInto = mock.fn();

			await NodejsComponent.handleProtocols(
				buildProps.protocols!,
				"typescript",
				tempDir,
				srcDir,
			);

			for (const [protocolName, protocolBuildResult] of Object.entries(
				protocols,
			)) {
				expect(NodejsComponent.copyProtocolInto).toHaveBeenCalledWith(
					protocolName,
					protocolBuildResult,
					"typescript",
					tempDir,
					srcDir,
				);
			}
		} finally {
			NodejsComponent.copyProtocolInto = original;
		}
	});
});
