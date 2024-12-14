/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobX,
	GithubNodePipelinePackageSteps,
	GithubPipelineX,
	GithubStepX,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import { CurrentState } from "@levicape/fourtwo/ci/cd/state";
import {
	type GithubNodePipelineJobProps,
	GithubPipelineNodeScriptsX,
	GithubPipelineNodeSetupX,
} from "@levicape/fourtwo/ci/codegen/github";

let {
	current: { register, $ },
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
			name="Build, Lint and Test package"
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
					{(node: GithubNodePipelineJobProps) => {
						return (
							<>
								<GithubStepX
									name={"Build module"}
									run={[
										new GithubNodePipelinePackageSteps()
											.getScript(node.configuration)("build:ci")
											.build().run!,
									]}
								/>
								<GithubPipelineNodeScriptsX
									{...node}
									scripts={["lint:format"]}
								/>
								<GithubPipelineNodeScriptsX
									{...node}
									scripts={["test:canary"]}
								/>
							</>
						);
					}}
				</GithubPipelineNodeSetupX>
			}
		/>
	</GithubPipelineX>
);

// TODO: Upload / Download artifacts between parent and children
