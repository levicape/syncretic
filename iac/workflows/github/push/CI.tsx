/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/syncretic */

import type { GithubNodeWorkflowJobProps } from "@levicape/syncretic/ci/codegen/github/node/GithubNodeWorkflowJobStepCodegen";
import {
	GithubJobBuilder,
	GithubJobX,
	GithubStepCheckoutX,
	GithubStepNodeInstallX,
	GithubStepNodeSetupX,
	GithubStepX,
	GithubWorkflowExpressions,
	GithubWorkflowX,
} from "@levicape/syncretic/github";

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
			secret: "NPM_TOKEN",
		},
		version: {
			node: "22.13.0",
		},
	}) as const;

export default async () => (
	<GithubWorkflowX
		name="on Push: Compile, Lint, Test all workspace packages"
		on={{
			push: {},
		}}
	>
		<GithubJobX
			id="build"
			name="Compile, Lint and Test all workspace packages"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX
						configuration={NodeGhaConfiguration({ env })}
						children={(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name="Compile"
										run={[
											"pnpm exec nx run-many -t build --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStepX
										name="Lint"
										run={[
											"pnpm exec nx run-many -t lint --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStepX
										name="Test"
										run={[
											"pnpm exec nx run-many -t test --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStepX
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
		<GithubJobX
			id="build-image"
			name="Build Docker Image"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX configuration={NodeGhaConfiguration({ env })}>
						{(node: GithubNodeWorkflowJobProps) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name="Build Docker Image"
										run={[
											"pnpm exec nx pack:build iac-images-application --verbose",
										]}
									/>
								</>
							);
						}}
					</GithubStepNodeSetupX>
				</>
			}
		/>
	</GithubWorkflowX>
);
