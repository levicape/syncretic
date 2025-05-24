/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/fourtwo */

import {
	GithubJob,
	GithubJobBuilder,
	GithubStep,
	GithubStepCheckout,
	GithubStepNodeSetup,
	GithubWorkflow,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/github";
import { Fragment } from "@levicape/fourtwo/jsx-runtime";
import { stringify } from "yaml";

const {
	current: { context: _$_, env },
} = GithubWorkflowExpressions;

const workflows = (
	<GithubWorkflow
		name="on Push"
		on={{
			push: {},
		}}
	>
		<GithubJob
			id="build"
			name="Compile, Lint and Test all workspace packages"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<Fragment>
					<GithubStepCheckout />
					<GithubStepNodeSetup
						configuration={{
							packageManager: {
								node: "pnpm",
							},
							registry: {
								scope: "@levicape",
								host: `${env("LEVICAPE_REGISTRY")}`,
							},
							version: {
								node: "22.13.0",
							},
						}}
						children={(node) => {
							return (
								<Fragment>
									<GithubStep
										name="Compile"
										run={["echo 'Compile all packages'"]}
									/>
								</Fragment>
							);
						}}
					/>
				</Fragment>
			}
		/>
	</GithubWorkflow>
);

const yaml = stringify(workflows.build());
console.log(yaml);
