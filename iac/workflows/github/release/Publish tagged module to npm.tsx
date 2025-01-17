/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobBuilder,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import {
	GithubJobX,
	GithubStepCheckoutX,
	GithubStepX,
	GithubWorkflowX,
} from "@levicape/fourtwo/x/github";
import {
	GithubStepNodeInstallX,
	GithubStepNodeScriptsX,
	GithubStepNodeSetupX,
} from "@levicape/fourtwo/x/github/node";
import { NodeGhaConfiguration } from "../push/CI.js";

type CompileAndPublishProps = {
	cwd?: string;
	packageName: string;
};

export default (
	(props: {
		compileAndPublish?: CompileAndPublishProps[];
	}) =>
	async () => {
		let {
			current: { register, context: _$_, env },
		} = GithubWorkflowExpressions;

		let CompileAndPublish = ({ cwd, packageName }: CompileAndPublishProps) => {
			let shortname = packageName.split("/").pop();
			return (
				<GithubJobX
					id={`publish_${shortname}`}
					name={`${packageName}: Compile and publish to Github`}
					runsOn={GithubJobBuilder.defaultRunsOn()}
					packages={"write"}
					contents={"read"}
					defaults={
						cwd
							? {
									run: { "working-directory": cwd },
								}
							: undefined
					}
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
							<GithubStepCheckoutX />
							<GithubStepNodeSetupX
								configuration={NodeGhaConfiguration({ env })}
								options={{}}
							>
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
							<GithubStepNodeScriptsX
								configuration={NodeGhaConfiguration({ env })}
								scripts={["prepublish"]}
							/>
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
							<GithubStepX
								if={"success()"}
								name={"Publish to npm"}
								continueOnError={true}
								run={["pnpm publish --no-git-checks;"]}
							/>
						</>
					}
				/>
			);
		};

		let packageScope = props.compileAndPublish?.[0]?.packageName.split("/")[0];
		let names = props.compileAndPublish
			?.map((props) => props.packageName.split("/").pop())
			.join(", ");

		return (
			<GithubWorkflowX
				name={`on Release: [released] Publish ${packageScope}/(${names}) to Github`}
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
				{props.compileAndPublish
					? props.compileAndPublish.map((props) => (
							<CompileAndPublish {...props} />
						))
					: []}
			</GithubWorkflowX>
		);
	}
)({
	compileAndPublish: [
		{ packageName: "@levicape/fourtwo" },
		{
			packageName: "@levicape/fourtwo-pulumi",
			cwd: "packages/pulumi",
		},
		{
			packageName: "@levicape/fourtwo-builders",
			cwd: "packages/builders",
		},
	],
});
