import { execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import test, { beforeEach, describe, it, mock, type Mock } from "node:test";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { expect } from "expect";
import type { Context } from "../../../../context/Context.js";
import {
	GolangComponent,
	type GolangComponentBuildProps,
	type GolangComponentBuildResult,
} from "./GolangComponent.js";

mock.module("node:child_process", {
	namedExports: {
		execSync: mock.fn(),
	},
});

mock.module("node:fs", {
	namedExports: {
		cpSync: mock.fn(),
		mkdirSync: mock.fn(),
		rmSync: mock.fn(),
		existsSync: mock.fn(),
		writeFileSync: mock.fn(),
	},
});

mock.module("folder-hash", {
	namedExports: {
		hashElement: mock.fn(() => ({ hash: "some_hash" })),
	},
});

mock.module("@pulumi/pulumi/runtime/index.js", {
	namedExports: {
		isDryRun: mock.fn(),
	},
});

describe("GolangComponent", () => {
	const mockContext = {} as Context;

	beforeEach(() => {
		mock.restoreAll();
	});

	test("should build with Docker successfully", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		// @ts-expect-error
		(execSync as Mock<typeof execSync>).mock.mockImplementation(() => {});
		(cpSync as Mock<typeof cpSync>).mock.mockImplementation(() => {});
		(mkdirSync as Mock<typeof mkdirSync>).mock.mockImplementation(() => {});
		(writeFileSync as Mock<typeof writeFileSync>).mock.mockImplementation(
			() => {},
		);

		const props: GolangComponentBuildProps = {
			command: "go build -o build",
			copyFrom: { local: { path: "/path/to/source" } },
			executor: "DOCKER",
			envs: { GO_ENV: "production" },
			goVersion: "1.21",
			artifact: "build",
			srcRoot: "src",
			main: "main.go",
			protocols: {},
		};

		const result = await GolangComponent.build(mockContext, props);

		expect(result).toMatchObject(
			expect.objectContaining({
				root: expect.any(String) as unknown as string,
				buildId: "some_hash",
				rootId: props.copyFrom.local!.path.replaceAll("/", "_"),
				main: props.main,
				goVersion: props.goVersion,
				build: {
					artifacts: [
						// "build-linux-amd64",
						"linux_arm64/build",
						"darwin_arm64/build",
						// "build-js-wasm",
						// "build-darwin-amd64",
					],
				} satisfies GolangComponentBuildResult["build"],
			} satisfies GolangComponentBuildResult),
		);
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("docker build"),
			expect.any(Object),
		);
		expect(cpSync).toHaveBeenCalled();
		expect(mkdirSync).toHaveBeenCalled();
	});

	test("should build with Shell successfully", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(
			// @ts-expect-error
			() => "temp__dir",
		);
		(cpSync as Mock<typeof cpSync>).mock.mockImplementation(() => {});
		(mkdirSync as Mock<typeof mkdirSync>).mock.mockImplementation(() => {});

		const props: GolangComponentBuildProps = {
			command: "go build -o build",
			copyFrom: { local: { path: "/path/to/source" } },
			executor: "SHELL",
			envs: { GO_ENV: "production" },
			goVersion: "1.22",
			artifact: "build",
			srcRoot: "src",
			main: "main.go",
			protocols: {},
		};

		const result = await GolangComponent.build(mockContext, props);

		expect(result).toEqual({
			root: expect.any(String),
			buildId: "some_hash",
			rootId: props.copyFrom.local!.path.replaceAll("/", "_"),
			main: props.main,
			goVersion: props.goVersion,
			build: {
				artifacts: [
					"linux_amd64/build",
					"linux_arm64/build",
					"js_wasm/build",
					"darwin_amd64/build",
					"darwin_arm64/build",
				],
			},
		});
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("go build"),
			expect.any(Object),
		);
		expect(cpSync).toHaveBeenCalled();
		expect(mkdirSync).toHaveBeenCalled();
	});

	test("should handle source from Git", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(
			// @ts-expect-error
			() => "temp__dir",
		);

		const props: GolangComponentBuildProps = {
			command: "go build -o build",
			copyFrom: {
				git: { url: "https://github.com/example/repo.git", branch: "main" },
			},
			executor: "SHELL",
			envs: { GO_ENV: "production" },
			goVersion: "1.21",
			artifact: "build",
			srcRoot: "src",
			main: "main.go",
			protocols: {},
		};

		await GolangComponent.build(mockContext, props);

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("git clone"),
			expect.any(Object),
		);
	});

	test("should handle source from local", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		// @ts-expect-error
		(execSync as Mock<typeof execSync>).mock.mockImplementation(() => {});

		const props: GolangComponentBuildProps = {
			command: "go build -o build",
			copyFrom: { local: { path: "/path/to/source" } },
			executor: "SHELL",
			envs: { GO_ENV: "production" },
			goVersion: "1.21",
			artifact: "build",
			srcRoot: "src",
			main: "main.go",
			protocols: {},
		};

		await GolangComponent.build(mockContext, props);

		expect(cpSync).toHaveBeenCalledWith("/path/to/source", expect.any(String), {
			recursive: true,
		});
	});

	test("should throw error for invalid executor", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		const props: GolangComponentBuildProps = {
			command: "go build -o build",
			copyFrom: { local: { path: "/path/to/source" } },
			executor: "INVALID_EXECUTOR" as unknown as "SHELL",
			envs: { GO_ENV: "production" },
			goVersion: "1.23",
			artifact: "build",
			srcRoot: "src",
			main: "main.go",
			protocols: {},
		};

		await expect(GolangComponent.build(mockContext, props)).rejects.toThrow(
			"Invalid executor specified.",
		);
	});
	describe("getSourceIdentifier", () => {
		test("should throw an error for invalid copyFrom source", async () => {
			const invalidCopyFrom = {}; // Invalid copyFrom source

			await expect(
				GolangComponent.getSourceIdentifier(invalidCopyFrom),
			).rejects.toThrow("Invalid copyFrom source.");
		});
	});

	describe("handleSource", () => {
		it("should throw an error when no valid source is provided in copyFrom", async () => {
			const invalidCopyFrom = {}; // Invalid copyFrom source

			await expect(
				GolangComponent.handleSource(invalidCopyFrom, ""),
			).rejects.toThrow("No valid source provided in 'copyFrom'.");
		});
	});

	describe("handleProtocols", () => {
		test("should copy protocols map correctly", async () => {
			const original = GolangComponent.copyProtocolInto;
			GolangComponent.copyProtocolInto = mock.fn();
			try {
				const tempDir = "/path/to/temp";
				const srcDir = "src";
				const props: GolangComponentBuildProps = {
					command: "go build -o build",
					copyFrom: { local: { path: "/path/to/source" } },
					executor: "INVALID_EXECUTOR" as unknown as "SHELL",
					envs: { GO_ENV: "production" },
					goVersion: "1.23",
					artifact: "build",
					srcRoot: "src",
					main: "main.go",
					protocols: {
						abc: {
							root: "/path/to/abc/build",
							buildId: "abc-build-id",
							protocolDir: "abc",
						},
					},
				};

				await GolangComponent.handleProtocols(
					props.protocols!,
					"gogo",
					tempDir,
					srcDir,
				);

				for (const [protocolName, protocolBuildResult] of Object.entries(
					props.protocols!,
				)) {
					expect(GolangComponent.copyProtocolInto).toHaveBeenCalledWith(
						protocolName,
						protocolBuildResult,
						"gogo",
						tempDir,
						srcDir,
					);
				}
			} finally {
				GolangComponent.copyProtocolInto = original;
			}
		});
	});
});
