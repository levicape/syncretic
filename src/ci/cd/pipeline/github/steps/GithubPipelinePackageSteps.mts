import VError from "verror";
import { CurrentState } from "../../../state/CurrentState.mjs";
import type { PipelinePackageSteps } from "../../../steps/PipelinePackageSteps.mjs";
import { GithubStepBuilder } from "../GithubStepBuilder.mjs";

export type GithubPipelineNodePackageProps = {
	version: {
		node?: "22.12.0";
	};
	packageManager: {
		node: "npm" | "pnpm" | "yarn";
	};
	registry: {
		scope: string;
	};
};

export class GithubNodePipelinePackageSteps<
	Uses extends string,
	With extends string,
> implements
		PipelinePackageSteps<
			GithubStepBuilder<Uses, With>,
			GithubPipelineNodePackageProps
		>
{
	getScript =
		(props: GithubPipelineNodePackageProps) =>
		(script: string): GithubStepBuilder<Uses, With> => {
			const {
				packageManager: { node: npm },
			} = props;

			if (!npm) {
				throw new VError("Package manager is required");
			}

			return new GithubStepBuilder<Uses, With>(
				`Run package.json: ${script}`,
			).setRun([`${npm} run ${script}`]);
		};

	getCheckoutStep = (): GithubStepBuilder<Uses, With>[] => {
		return [
			new GithubStepBuilder<Uses, With>(
				"Checkout",
				"actions/checkout@v2" as Uses,
			),
		];
	};

	getPackageManager = ({
		version: { node },
		packageManager: { node: npm },
	}: GithubPipelineNodePackageProps): GithubStepBuilder<Uses, With>[] => {
		let steps = [];
		if (!node) {
			throw new VError("Node version is required");
		}

		switch (npm) {
			case "pnpm":
				steps.push(
					new GithubStepBuilder<Uses, With>(
						`Setup ${npm}`,
						"pnpm/action-setup@v4" as Uses,
						{} as unknown as Record<With, string | undefined>,
					),
				);
				break;
			case "yarn":
			case "npm":
				break;
			default:
				throw new VError("Unknown package manager");
		}

		return steps;
	};

	getRuntime = ({
		version: { node },
		packageManager: { node: npm },
		registry: { scope },
	}: GithubPipelineNodePackageProps): GithubStepBuilder<Uses, With>[] => {
		const {
			current: { env, context, secret, register },
		} = CurrentState;

		if (!node) {
			throw new VError("Node version is required");
		}

		if (!scope.startsWith("@")) {
			throw new VError("Scope must start with @");
		}

		return [
			new GithubStepBuilder<Uses, With>(
				`Setup Node ${node}`,
				"actions/setup-node@v4" as Uses,
				{
					["node-version" as With]: node as string | undefined,
					["registry-url" as With]:
						npm === "pnpm"
							? `${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}/`
							: undefined,
					["cache" as With]: npm === "pnpm" ? "pnpm" : undefined,
					["cache-dependency-path" as With]:
						npm === "pnpm" ? "pnpm-lock.yaml" : undefined,
					["scope" as With]: npm === "pnpm" ? scope : undefined,
				} as unknown as Record<With, string | undefined>,
			).setEnv({
				...register("NODE_AUTH_TOKEN", secret("GITHUB_TOKEN")),
			}),

			new GithubStepBuilder<Uses, With>(
				"Cache node modules",
				"actions/cache@v3" as Uses,
				{
					["path" as With]: "~/.npm",
					["key" as With]: `${context("runner.os")}-build-${env("cache-name")}-${context("hashFiles('**/pnpm-lock.json')")}`,
					["restore-keys" as With]: [
						`${context("runner.os")}-build-${env("cache-name")}-`,
						`${context("runner.os")}-build-`,
						`${context("runner.os")}-`,
					].join("\n"),
				} as unknown as Record<With, string | undefined>,
			)
				.setId("cache-npm")
				.setEnv({
					...register("cache-name", "cache-node-modules"),
				}),
		];
	};

	getInstallModules = ({
		version: { node },
		packageManager: { node: npm },
	}: GithubPipelineNodePackageProps) => {
		const {
			current: { context },
		} = CurrentState;

		if (!node) {
			throw new VError("Node version is required");
		}
		return [
			new GithubStepBuilder<Uses, With>("List Dependencies")
				.setIf(context(`steps.cache-npm.outputs.cache-hit != 'true'`))
				.setRun([`${npm} list`])
				.setContinueOnError(true),

			new GithubStepBuilder<Uses, With>("Install Dependencies").setRun([
				`${npm} install`,
			]),
		];
	};
}
