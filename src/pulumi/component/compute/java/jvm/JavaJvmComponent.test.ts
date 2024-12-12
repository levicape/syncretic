import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { describe, type Mock, mock } from "node:test";
import { isDryRun } from "@pulumi/pulumi/runtime/index.js";
import { expect } from "expect";
import type { Context } from "../../../../../context/Context.js";
import {
	JavaJvmComponent,
	type JavaJvmComponentBuildProps,
} from "./JavaJvmComponent.js";

mock.module("node:fs", {
	namedExports: {
		cpSync: mock.fn(),
		mkdirSync: mock.fn(),
		rmSync: mock.fn(),
		existsSync: mock.fn(),
		writeFileSync: mock.fn(),
	},
});

mock.module("node:os", {
	namedExports: {
		tmpdir: mock.fn(() => {
			return randomUUID();
		}),
	},
});

mock.module("folder-hash", {
	namedExports: {
		hashElement: mock.fn(() => {
			return { hash: "some_hash" };
		}),
	},
});

mock.module("@pulumi/pulumi/runtime/index.js", {
	namedExports: {
		isDryRun: mock.fn(),
	},
});

mock.module("node:child_process", {
	namedExports: {
		execSync: mock.fn(),
	},
});

describe("JavaJvmComponent", () => {
	const context: Context = {
		prefix: "test-prefix",
		environment: { isProd: true, features: ["aws"] },
		stage: "dev",
	};

	const buildProps: JavaJvmComponentBuildProps = {
		artifact: "build/libs",
		copyFrom: { local: { path: "local/path" } },
		handler: "leaf.test",
		version: {
			jvm: "21",
			arch: "aarch64",
			image: "container-registry.oracle.com/graalvm/jdk:21",
		},
		jdk: {
			image: "gradle:8.10-jdk21-alpine",
		},
		command: "gradle shadowDistZip",
		envs: {},
		srcRoot: "src",
		executor: "DOCKER",
		protocols: {},
	} satisfies JavaJvmComponentBuildProps;

	test("should build with Docker using provided JDK image", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(
			// @ts-expect-error
			(cmd: string) => {
				if (cmd.startsWith("docker build")) {
					return "Docker build output";
				}
				if (cmd.startsWith("docker run")) {
					return "Docker run output";
				}
				throw new Error("Unexpected command");
			},
		);
		(mkdirSync as Mock<typeof mkdirSync>).mock.mockImplementation(() => {});
		(writeFileSync as Mock<typeof writeFileSync>).mock.mockImplementation(
			() => {},
		);

		const tempDir = path.join(process.cwd(), "temp");
		const copyTo = path.join(process.cwd(), "build");

		await JavaJvmComponent.buildWithDocker(
			tempDir,
			copyTo,
			buildProps.envs ?? {},
			buildProps.jdk,
			buildProps.version,
			buildProps.command,
			buildProps.artifact,
		);

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("docker build"),
			expect.anything(),
		);
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("docker run"),
			expect.anything(),
		);

		const dockerfileContent = `
        FROM ${buildProps.jdk.image}
        WORKDIR /app
        COPY ./gradle ./*.gradle* ./*.properties *.yml ./
        RUN gradle dependencies --no-daemon
        COPY . .
        RUN ${buildProps.command} --no-daemon
      `;
		expect(writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("Dockerfile"),
			dockerfileContent,
		);
	});

	test("should build with Docker using curl", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(
			// @ts-expect-error
			(cmd: string) => {
				if (cmd.startsWith("docker build")) {
					return "Docker build output";
				}
				if (cmd.startsWith("docker run")) {
					return "Docker run output";
				}
				throw new Error("Unexpected command");
			},
		);
		(mkdirSync as Mock<typeof mkdirSync>).mock.mockImplementation(() => {});
		(writeFileSync as Mock<typeof writeFileSync>).mock.mockImplementation(
			() => {},
		);

		const tempDir = path.join(process.cwd(), "temp");
		const copyTo = path.join(process.cwd(), "build");

		const curlBuildProps: JavaJvmComponentBuildProps = {
			...buildProps,
			jdk: {
				image: undefined,
				curl: {
					base: "public.ecr.aws/amazonlinux/amazonlinux:2023",
					url: "https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_linux-aarch64_bin.tar.gz",
				},
			},
		};

		await JavaJvmComponent.buildWithDocker(
			tempDir,
			copyTo,
			curlBuildProps.envs ?? {},
			curlBuildProps.jdk,
			curlBuildProps.version,
			curlBuildProps.command,
			buildProps.artifact,
		);

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("docker build"),
			expect.anything(),
		);

		const dockerfileContent = `
FROM ${curlBuildProps.jdk?.curl?.base ?? "public.ecr.aws/amazonlinux/amazonlinux:2023"}
WORKDIR /app
RUN curl -4 -L ${curlBuildProps.jdk?.curl?.url ?? ""} | tar -xvz
RUN mv graalvm-jdk-21* /usr/lib/graalvm
ENV JAVA_HOME /usr/lib/graalvm
COPY . .
RUN ./${curlBuildProps.command}`;

		expect(writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("Dockerfile"),
			dockerfileContent,
		);
	});

	test("should handle Gradle build command in Docker", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(
			// @ts-expect-error
			() => "Gradle build output",
		);
		(mkdirSync as Mock<typeof mkdirSync>).mock.mockImplementation(() => {});
		(writeFileSync as Mock<typeof writeFileSync>).mock.mockImplementation(
			() => {},
		);

		const tempDir = path.join(process.cwd(), "temp");
		const copyTo = path.join(process.cwd(), "build");

		await JavaJvmComponent.buildWithDocker(
			tempDir,
			copyTo,
			buildProps.envs ?? {},
			buildProps.jdk,
			buildProps.version,
			"gradle build",
			buildProps.artifact,
		);

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("docker build"),
			expect.anything(),
		);
	});

	test("should handle errors during Docker build", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(() => {
			throw new Error("Unexpected command");
		});

		const tempDir = path.join(process.cwd(), "temp");
		const copyTo = path.join(process.cwd(), "build");

		await expect(
			JavaJvmComponent.buildWithDocker(
				tempDir,
				copyTo,
				buildProps.envs ?? {},
				buildProps.jdk,
				buildProps.version,
				buildProps.command,
				buildProps.artifact,
			),
		).rejects.toThrow("Docker build failed");
	});

	test("should handle shell build with Gradle", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(
			// @ts-expect-error
			(cmd: string) => {
				if (cmd.startsWith(`cd ${path.join(process.cwd(), "temp")}`)) {
					return "Shell build output";
				}
				throw new Error("Unexpected command");
			},
		);
		(mkdirSync as Mock<typeof mkdirSync>).mock.mockImplementation(() => {});
		(writeFileSync as Mock<typeof writeFileSync>).mock.mockImplementation(
			() => {},
		);

		const tempDir = path.join(process.cwd(), "temp");
		const copyTo = path.join(process.cwd(), "build");
		const spawnArgs = { encoding: "ascii", env: buildProps.envs ?? {} };

		await JavaJvmComponent.buildWithShell(
			tempDir,
			copyTo,
			buildProps.envs ?? {},
			buildProps.copyFrom,
			buildProps.command,
		);

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining(buildProps.command),
			spawnArgs,
		);
	});

	test("should handle shell build errors", async () => {
		(execSync as Mock<typeof execSync>).mock.mockImplementation(() => {
			throw new Error("Shell build failed");
		});

		const tempDir = path.join(process.cwd(), "temp");
		const copyTo = path.join(process.cwd(), "build");

		await expect(
			JavaJvmComponent.buildWithShell(
				tempDir,
				copyTo,
				buildProps.envs ?? {},
				buildProps.copyFrom,
				buildProps.command,
			),
		).rejects.toThrow("Shell build failed");
	});

	test("should handle invalid copyFrom path", async () => {
		(isDryRun as Mock<typeof isDryRun>).mock.mockImplementation(() => true);
		(execSync as Mock<typeof execSync>).mock.mockImplementation(() => {
			throw new Error("Invalid path");
		});

		const invalidBuildProps = {
			...buildProps,
			copyFrom: { local: { path: "invalid/path" } },
		};

		await expect(
			JavaJvmComponent.build(context, invalidBuildProps),
		).rejects.toThrow("Invalid path");
	});
});
