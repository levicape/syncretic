/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/fourtwo */

import {
	GithubJob,
	GithubJobBuilder,
	GithubStep,
	GithubWorkflow,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/github";
import { Fragment } from "@levicape/fourtwo/jsx-runtime";
import { GithubStepCheckout } from "@levicape/fourtwo/jsx/github/steps/GithubStepCheckout";

const {
	current: { context: _$_, env },
} = GithubWorkflowExpressions;

export default () => (
	<GithubWorkflow
		name="on Push"
		on={{
			push: {},
		}}
	>
		<GithubJob
			id={"build"}
			name={"Step"}
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<Fragment>
					<GithubStepCheckout />
					<GithubStep name={"Compile"} run={["echo 'Hello world'"]} />
				</Fragment>
			}
		/>
	</GithubWorkflow>
);
