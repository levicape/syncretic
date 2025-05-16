/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/fourtwo */

import {
	GithubJobBuilder,
	GithubJobX,
	GithubStepCheckoutX,
	GithubStepNodeSetupX,
	GithubStepX,
	GithubWorkflowExpressions,
	GithubWorkflowX,
} from "@levicape/fourtwo/github";
import { Fragment } from "@levicape/fourtwo/jsx-runtime";
import { stringify } from "yaml";

const {
	current: { context: _$_, env },
} = GithubWorkflowExpressions;

const workflows = (
	<GithubWorkflowX
		name="on Push"
		on={{
			push: {},
		}}
	>
		<GithubJobX
			id="build"
			name="Compile, Lint and Test all workspace packages"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<Fragment>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX
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
									<GithubStepX
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
	</GithubWorkflowX>
);

const yaml = stringify(workflows.build());
console.log(yaml);
