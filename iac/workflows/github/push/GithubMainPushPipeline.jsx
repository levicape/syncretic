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
	current: { register, context: _$_ },
} = CurrentState;

export default (
	<GithubPipelineX
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
									name={"Compile module"}
									run={[
										new GithubNodePipelinePackageSteps()
											.getScript(node.configuration)("compile")
											.build().run,
									]}
								/>
								<GithubPipelineNodeScriptsX {...node} scripts={["lint"]} />
								<GithubPipelineNodeScriptsX {...node} scripts={["test"]} />
							</>
						);
					}}
				</GithubPipelineNodeSetupX>
			}
		/>
	</GithubPipelineX>
);

// TODO: Upload / Download artifacts between parent and children
