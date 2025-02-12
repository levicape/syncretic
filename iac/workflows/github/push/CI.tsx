import { GithubJobBuilder } from "@levicape/fourtwo/ci/cd/pipeline/github/GithubJobBuilder";
/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */
import type { GithubWorkflowBuilder } from "@levicape/fourtwo/ci/cd/pipeline/github/GithubWorkflowBuilder";
import { GithubWorkflowExpressions } from "@levicape/fourtwo/ci/cd/pipeline/github/GithubWorkflowExpressions";
import { GithubJobX } from "@levicape/fourtwo/jsx/github/GithubJobX";
import { GithubStepX } from "@levicape/fourtwo/jsx/github/GithubStepX";
import { GithubWorkflowX } from "@levicape/fourtwo/jsx/github/GithubWorkflowX";
import { GithubStepCheckoutX } from "@levicape/fourtwo/jsx/github/steps/GithubStepCheckoutX";
import { GithubStepNodeInstallX } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeInstallX";
import { GithubStepNodeSetupX } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeSetupX";

let {
	current: { register, context: _$_, env },
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
			host: `${e("NPM_REGISTRY_PROTOCOL")}://${e("NPM_REGISTRY_HOST")}`,
			secret,
		},
		version: {
			node: "22.12.0",
		},
	}) as const;

export default (): GithubWorkflowBuilder<string, string> => (
	<GithubWorkflowX
		name="on Push: Test Package"
		on={{
			push: {
				branches: ["main"],
			},
		}}
		env={{
			...register("NPM_REGISTRY_PROTOCOL", "https"),
			...register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
		}}
	>
		<GithubJobX
			id="build"
			name="Compile, Lint and Test all workspace packages"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX configuration={NodeGhaConfiguration({ env })}>
						{(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name="Compile"
										run={[
											"pnpm exec nx run-many -t compile --parallel=1 --verbose --no-cloud",
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
								</>
							);
						}}
					</GithubStepNodeSetupX>
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
						{(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name="Build Docker Image"
										run={[
											"pnpm exec nx pack:build iac-images-application --verbose",
										]}
										env={{
											IMAGE_NAME: "levicape-fourtwo",
										}}
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
