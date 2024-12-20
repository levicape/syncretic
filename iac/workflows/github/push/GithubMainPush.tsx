/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobBuilder,
	type GithubWorkflowBuilder,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import {
	GithubJobX,
	GithubStepCheckoutX,
	GithubWorkflowX,
} from "@levicape/fourtwo/x/github";
import {
	GithubStepNodeInstallX,
	GithubStepNodeScriptsX,
	GithubStepNodeSetupX,
} from "@levicape/fourtwo/x/github/node";

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
			name="Compile, Lint and Test package"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX configuration={NodeGhaConfiguration({ env })}>
						{(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepNodeScriptsX {...node} scripts={["compile"]} />
									<GithubStepNodeScriptsX {...node} scripts={["lint"]} />
									<GithubStepNodeScriptsX {...node} scripts={["test"]} />
								</>
							);
						}}
					</GithubStepNodeSetupX>
				</>
			}
		/>
	</GithubWorkflowX>
);
