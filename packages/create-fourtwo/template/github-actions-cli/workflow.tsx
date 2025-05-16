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
const {
	current: { context: _$_, env },
} = GithubWorkflowExpressions;

export default () => (
	<GithubWorkflowX
		name="on Push"
		on={{
			push: {},
		}}
	>
		<GithubJobX
			id={"build"}
			name={"Step"}
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
								scope: "@scope",
								host: `${env("NPM_REGISTRY")}`,
							},
							version: {
								node: "22.13.0",
							},
						}}
						children={(node) => {
							return (
								<Fragment>
									<GithubStepX name={"Compile"} run={["echo 'Hello world'"]} />
								</Fragment>
							);
						}}
					/>
				</Fragment>
			}
		/>
	</GithubWorkflowX>
);
