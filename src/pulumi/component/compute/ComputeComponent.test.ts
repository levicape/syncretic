import test, { describe, mock } from "node:test";
import { Output } from "@pulumi/pulumi/index.js";
import { expect } from "expect";
import type { Context } from "../../../context/Context.js";
import {
	ComputeComponent,
	type ComputeComponentProps,
} from "./ComputeComponent.js";

// Mock Context if needed
mock.module("../../context/Context.js", {
	namedExports: {
		Context: {
			fromConfig: mock.fn(() => ({
				isProd: true,
			})),
		},
	},
});

describe("ComputeComponent", () => {
	const mockContext = {
		environment: { isProd: true },
	} as unknown as Context;

	const buildResult = {
		buildId: "some_build_id",
		root: "some_root",
	};

	const computeProps: ComputeComponentProps = {
		context: mockContext,
		build: buildResult,
		envs: Output.create({ TEST_ENV_VAR: "value" } as Record<string, string>),
		memorySize: "512MB",
	};

	test("should create ComputeComponent with provided props", () => {
		const urn = "test-urn";
		const name = "test-name";

		const computeComponent = new ComputeComponent(urn, name, computeProps);

		expect(computeComponent).toBeInstanceOf(ComputeComponent);
	});

	test("should handle empty environment", () => {
		const computePropsWithoutEnv: ComputeComponentProps = {
			context: mockContext,
			build: buildResult,
			envs: Output.create({} as Record<string, string>),
		};

		const urn = "test-urn-empty-env";
		const name = "test-name-empty-env";

		const computeComponent = new ComputeComponent(
			urn,
			name,
			computePropsWithoutEnv,
		);

		expect(computeComponent).toBeInstanceOf(ComputeComponent);
	});
});
