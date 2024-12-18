import VError from "verror";
import type { PipelinePackageSteps } from "../../../steps/PipelinePackageSteps.mjs";
import { GithubStepBuilder } from "../GithubStepBuilder.mjs";
import type { GithubWorkflowExpressions } from "../GithubWorkflowExpressions.mjs";

export type GithubPipelineNodePackageProps = {
	version: {
		node?: "22.12.0" | "16" | "18.19.0";
	};
	packageManager: {
		node: "npm" | "pnpm" | "yarn";
		cache?: boolean;
	};
	registry: {
		scope: string;
		host: string;
		secret?: string;
	};
	expressions: (typeof GithubWorkflowExpressions)["current"];
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
		registry: { scope, host, secret: secretName },
		expressions: { env, context, secret, register },
	}: GithubPipelineNodePackageProps): GithubStepBuilder<Uses, With>[] => {
		if (!node) {
			throw new VError("Node version is required");
		}

		if (!secretName) {
			secretName = "GITHUB_TOKEN";
		}

		if (!scope.startsWith("@")) {
			throw new VError("Scope must start with @");
		}

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
			).setEnv({
				...register("NODE_AUTH_TOKEN", secret(secretName)),
			}),
			...(cache
				? [
						new GithubStepBuilder<Uses, With>(
							"Cache node modules",
							"actions/cache@v3" as Uses,
							{
								["path" as With]: "~/.npm",
								["key" as With]: `${context("runner.os")}-build-npm-node-modules-${context("hashFiles('**/pnpm-lock.json')")}`,
								["restore-keys" as With]: [
									`${context("runner.os")}-build-npm-node-modules-`,
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
							`echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV`,
						]),
						new GithubStepBuilder<Uses, With>(
							"Cache pnpm files",
							"actions/cache@v3" as Uses,
							{
								["path" as With]: "${{ env.STORE_PATH }}",
								["key" as With]: `${context("runner.os")}-pnpm-store-${context("hashFiles('**/pnpm-lock.json')")}`,
								["restore-keys" as With]: [
									`${context("runner.os")}-pnpm-store-`,
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
		expressions: { context },
	}: GithubPipelineNodePackageProps) => {
		if (!node) {
			throw new VError("Node version is required");
		}
		return [
			...(cache
				? [
						new GithubStepBuilder<Uses, With>("List Dependencies")
							.setIf(context(`steps.cache-npm.outputs.cache-hit != 'true'`))
							.setRun([`${npm} list`])
							.setContinueOnError(true),
					]
				: []),

			new GithubStepBuilder<Uses, With>("Install Dependencies").setRun([
				`${npm} install`,
			]),
		];
	};
}
