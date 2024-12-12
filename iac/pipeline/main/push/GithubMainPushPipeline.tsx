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
	current: { register, context },
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
			runsOn={`${context("vars.RUNNER")}-${context("github.run_id")}-${context("github.run_attempt")}`}
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

// TODO: Provider pattern to manage runs-on and configuration instead of function children
// TODO: Add function signature to run/scripts in JSX and builder in addition to string
// TODO: Upload / Download artifacts between parent and children
// .setArtifactUpload()
// .setChildren([
// 	new GithubJobBuilder("lint", "Lint module").setSteps(
// 		GithubNodePipelineJobScripts({
// 			...node,
// 			scripts: ["lint:check"],
// 		}).steps,
// 	)
// 	// .setArtifactDownload()
// 	,
// 	new GithubJobBuilder("test", "Test module").setSteps(
// 		GithubNodePipelineJobScripts({
// 			...node,
// 			scripts: ["test:unit"],
// 		}).steps,
// 	)
// 	// .setArtifactDownload(),
// ]),
