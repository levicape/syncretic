/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/fourtwo */

import {
	GithubJob,
	GithubJobBuilder,
	GithubStep,
	GithubWorkflow,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/github";
import { GithubStepCheckout } from "@levicape/fourtwo/jsx/github/steps/GithubStepCheckout";
import { GithubStepNodeInstall } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeInstall";
import { GithubStepNodeSetup } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeSetup";

const {
	current: { register, context: _$_, env, secret },
} = GithubWorkflowExpressions;

export const NodeGhaConfiguration = ({
	env: e,
	secret,
	cache,
}: { env: typeof env; secret?: string; cache?: boolean }) =>
	({
		packageManager: {
			node: "pnpm",
			cache: !!(cache === undefined || cache === true),
		},
		registry: {
			scope: "@levicape",
			host: `${e("LEVICAPE_REGISTRY")}`,
			secret,
		},
		version: {
			node: "22.13.0",
		},
	}) as const;

export default async () => (
	<GithubWorkflow
		name="on Push: Compile, Lint, Test all workspace packages"
		on={{
			push: {},
		}}
		env={{
			...register("LEVICAPE_REGISTRY_HOST", "npm.pkg.github.com/"),
			...register("LEVICAPE_REGISTRY", "https://npm.pkg.github.com"),
			...register("LEVICAPE_TOKEN", secret("GITHUB_TOKEN")),
		}}
	>
		<GithubJob
			id="build"
			name="Compile, Lint and Test all workspace packages"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckout />
					<GithubStepNodeSetup
						configuration={NodeGhaConfiguration({ env })}
						children={(node) => {
							return (
								<>
									<GithubStepNodeInstall {...node} />
									<GithubStep
										name="Compile"
										run={[
											"pnpm exec nx run-many -t build --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStep
										name="Lint"
										run={[
											"pnpm exec nx run-many -t lint --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStep
										name="Test"
										run={[
											"pnpm exec nx run-many -t test --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStep
										name="Clean cache"
										run={[
											"pnpm store prune || true",
											"corepack cache clean || true",
										]}
									/>
								</>
							);
						}}
					/>
				</>
			}
		/>
		<GithubJob
			id="build-image"
			name="Build Docker Image"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckout />
					<GithubStepNodeSetup configuration={NodeGhaConfiguration({ env })}>
						{(node) => {
							return (
								<>
									<GithubStepNodeInstall {...node} />
									<GithubStep
										name="Build Docker Image"
										run={[
											"pnpm exec nx pack:build iac-images-application --verbose",
										]}
									/>
								</>
							);
						}}
					</GithubStepNodeSetup>
				</>
			}
		/>
	</GithubWorkflow>
);
