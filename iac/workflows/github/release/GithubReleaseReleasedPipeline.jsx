/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobBuilder,
	GithubJobX,
	GithubNodePipelinePackageSteps,
	GithubPipelineX,
	GithubStepX,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import { CurrentState } from "@levicape/fourtwo/ci/cd/state";
import {
	GithubPipelineNodeScriptsX,
	GithubPipelineNodeSetupX,
} from "@levicape/fourtwo/ci/codegen/github";

let {
	current: { register, context: _$_, env },
} = CurrentState;

// const enquirer = new Enquirer();
// const prompt = enquirer.prompt.bind(enquirer);

export default (
	<GithubPipelineX
		name="on Release: [released] Publish package"
		on={{
			release: {
				types: ["released"],
			},
		}}
		env={{
			...register("NPM_REGISTRY_PROTOCOL", "https"),
			...register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
		}}
	>
		<GithubJobX
			id="packages"
			name="Build, Lint and Test package"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			permissions={{
				packages: "write",
				contents: "read",
			}}
			steps={
				<>
					<GithubStepX
						name={"Verify registry URL"}
						continueOnError={true}
						run={[
							`echo "NPM_REGISTRY_URL: ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}"`,
							`curl -v --insecure ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}`,
						]}
					/>
					<GithubPipelineNodeSetupX
						configuration={{
							packageManager: {
								node: "pnpm",
							},
							registry: {
								scope: "@levicape",
							},
							version: {
								node: "22.12.0",
							},
						}}
						options={{}}
					>
						{(node) => {
							return (
								<>
									<GithubStepX
										name={"Verify registry URL"}
										continueOnError={true}
										run={[
											`echo "NPM_REGISTRY_URL: ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}"`,
											`echo "NPM_REGISTRY_SCOPE: ${node.configuration.registry.scope}"`,
											`curl -v --insecure ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}`,
										]}
									/>
									<GithubStepX
										name={"Compile module"}
										run={[
											new GithubNodePipelinePackageSteps()
												.getScript(node.configuration)("compile")
												.build().run,
										]}
									/>
									<GithubPipelineNodeScriptsX {...node} scripts={["lint"]} />
									<GithubPipelineNodeScriptsX {...node} scripts={["test"]} />
									<GithubStepX
										name={"Increment version"}
										run={[
											"export PREID=$RELEVANT_SHA",
											"export PREID=${PREID:0:10}",
											`export ARGS="--git-tag-version=false --commit-hooks=false"`,
											`npm version ${_$_("github.event.release.tag_name")}-$PREID.${_$_("github.run_number")} $ARGS --allow-same-version`,
										]}
										env={{
											RELEVANT_SHA: _$_(
												"github.event.release.target_commitish || github.sha",
											),
										}}
									/>
									<GithubPipelineNodeScriptsX
										{...node}
										scripts={["prepublish"]}
									/>
									<GithubStepX
										if={"success()"}
										name={"Increment version"}
										continueOnError={true}
										run={["pnpm publish --no-git-checks;"]}
									/>
								</>
							);
						}}
					</GithubPipelineNodeSetupX>
				</>
			}
		/>
	</GithubPipelineX>
);
