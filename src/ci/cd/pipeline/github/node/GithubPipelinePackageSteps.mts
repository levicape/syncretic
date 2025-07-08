import VError from "verror";
import type { PipelinePackageSteps } from "../../../steps/PipelinePackageSteps.mjs";
import { GithubStepBuilder } from "../GithubStepBuilder.mjs";
import type { GithubWorkflowExpressions } from "../GithubWorkflowExpressions.mjs";
import type { GithubPipelineNodeOptions } from "./GithubPipelineNodeOptions.mjs";

export type GithubPipelineNodePackageProps = {
	version: {
		node?: GithubPipelineNodeOptions["version"]["node"];
	};
	packageManager: {
		node: "npm" | "pnpm" | "yarn";
		cache?: boolean;
	};
	registry?: {
		scope?: string;
		host?: string;
		secret?: string;
	};
	expressions?: Partial<(typeof GithubWorkflowExpressions)["current"]>;
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
						node === "16"
							? ("pnpm/action-setup@v2.4.0" as Uses)
							: ("pnpm/action-setup@v4" as Uses),

						node === "16"
							? ({
									standalone: true,
								} as unknown as Record<With, string | undefined>)
							: ({} as unknown as Record<With, string | undefined>),
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
		packageManager: { node: npm, cache },
		registry,
		expressions,
	}: GithubPipelineNodePackageProps): GithubStepBuilder<Uses, With>[] => {
		let { scope, host, secret: secretName } = registry ?? {};
		let { env, context, secret, register } = expressions ?? {};

		if (!node) {
			throw new VError("Node version is required");
		}

		if (!secretName) {
			secretName = "GITHUB_TOKEN";
		}

		if (scope !== undefined && !scope?.startsWith("@")) {
			throw new VError("Scope must start with @");
		}

		const envsAvailable =
			register !== undefined && secret !== undefined && context !== undefined;
		return [
			new GithubStepBuilder<Uses, With>(
				`Setup Node ${node}`,
				node === "16"
					? ("actions/setup-node@v3" as Uses)
					: ("actions/setup-node@v4" as Uses),
				{
					["node-version" as With]: node as string | undefined,
					["registry-url" as With]:
						npm === "pnpm" || npm === "npm" ? host : undefined,
					["cache" as With]: npm === "pnpm" ? "pnpm" : undefined,
					["cache-dependency-path" as With]:
						npm === "pnpm" ? "pnpm-lock.yaml" : undefined,
					["scope" as With]: npm === "pnpm" ? scope : undefined,
				} as unknown as Record<With, string | undefined>,
			).setEnv(
				envsAvailable
					? {
							...register("NODE_AUTH_TOKEN", secret(secretName)),
						}
					: {},
			),
			...(cache
				? [
						new GithubStepBuilder<Uses, With>(
							"Cache node modules",
							"actions/cache@v3" as Uses,
							{
								["path" as With]: "~/.npm",
								["key" as With]: envsAvailable
									? `${context("runner.os")}-build-npm-node-modules-${context("hashFiles('**/pnpm-lock.json')")}`
									: "os-build-npm-node-modules-",
								["restore-keys" as With]: [
									envsAvailable
										? `${context("runner.os")}-build-npm-node-modules-`
										: "os-build-npm-node-modules-",
								].join("\n"),
							} as unknown as Record<With, string | undefined>,
						).setId("cache-npm"),
					]
				: []),
			...(cache && npm === "pnpm"
				? [
						new GithubStepBuilder<Uses, With>(
							"Get pnpm store directory",
						).setRun([
							// TODO: <GithubOutputX name value target? = $GITHUB_ENV /> -> string
							`echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV`,
						]),
						new GithubStepBuilder<Uses, With>(
							"Cache pnpm files",
							"actions/cache@v3" as Uses,
							{
								["path" as With]: "${{ env.STORE_PATH }}",
								["key" as With]: `${context?.("runner.os") ?? "os"}-pnpm-store-${context?.("hashFiles('**/pnpm-lock.json')") ?? ""}`,
								["restore-keys" as With]: [
									`${context?.("runner.os") ?? "os"}-pnpm-store-`,
								].join("\n"),
							} as unknown as Record<With, string | undefined>,
						).setId("cache-pnpm-store"),
					]
				: []),
		];
	};

	getInstallModules = ({
		version: { node },
		packageManager: { node: npm, cache },
		expressions,
	}: GithubPipelineNodePackageProps) => {
		if (!node) {
			throw new VError("Node version is required");
		}
		const { context } = expressions ?? {};
		const step = new GithubStepBuilder<Uses, With>("List Dependencies")
			.setRun([`${npm} list`])
			.setContinueOnError(true);
		if (context) {
			step.setIf(context?.(`steps.cache-npm.outputs.cache-hit != 'true'`));
		}

		return [
			...(cache ? [step] : []),
			new GithubStepBuilder<Uses, With>("Install Dependencies").setRun([
				`${npm} install`,
			]),
		];
	};
}
