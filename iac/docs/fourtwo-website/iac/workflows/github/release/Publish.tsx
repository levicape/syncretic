/** @jsxRuntime automatic */
/** @jsxImportSource @levicape/fourtwo */

import { GithubJobBuilder } from "@levicape/fourtwo/ci/cd/pipeline/github/GithubJobBuilder";
import { GithubWorkflowExpressions } from "@levicape/fourtwo/ci/cd/pipeline/github/GithubWorkflowExpressions";
import { Fragment } from "@levicape/fourtwo/jsx-runtime";
import { GithubJob } from "@levicape/fourtwo/jsx/github/GithubJob";
import { GithubStep } from "@levicape/fourtwo/jsx/github/GithubStep";
import { GithubWorkflow } from "@levicape/fourtwo/jsx/github/GithubWorkflow";
import { GithubStepCheckout } from "@levicape/fourtwo/jsx/github/steps/GithubStepCheckout";
import { GithubStepNodeInstall } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeInstall";
import { GithubStepNodeScripts } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeScripts";
import { GithubStepNodeSetup } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeSetup";
import { NodeGhaConfiguration } from "../push/CI.js";

type CompileAndPublishProps = {
	cwd?: string;
	packageName: string;
};

const compileAndPublish: CompileAndPublishProps[] = [
	{
		packageName: "@levicape/fourtwo",
	},
	{
		packageName: "@levicape/fourtwo-pulumi",
		cwd: "packages/pulumi",
	},
];

export default (
	(props: {
		compileAndPublish?: CompileAndPublishProps[];
	}) =>
	async () => {
		let {
			current: { register, context: _$_, env, secret },
		} = GithubWorkflowExpressions;

		let CompileAndPublish = ({ cwd, packageName }: CompileAndPublishProps) => {
			let shortname = packageName.split("/").pop();
			return (
				<GithubJob
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
						<Fragment>
							<GithubStepCheckout />
							<GithubStep
								name="Remove project .npmrc"
								run={(() => {
									const rootWorkspaceNpmrc = (() => {
										let pathSegments = cwd
											?.split("/")
											.filter((segment) => segment.length > 0)
											.map((segment) => "..")
											.join("/");
										if (pathSegments) {
											return `${pathSegments}/.npmrc`;
										}
										return `.npmrc`;
									})();

									return [
										`if [ -f ${rootWorkspaceNpmrc} ]; then rm ${rootWorkspaceNpmrc}; fi`,
										`if [ -f .npmrc ]; then rm .npmrc; fi`,
									];
								})()}
							/>
							<GithubStep
								name={"Verify registry URL"}
								continueOnError={true}
								run={[
									`echo "NPM_REGISTRY_URL: ${env("LEVICAPE_REGISTRY")}"`,
									`echo "NPM_REGISTRY_HOST: ${env("LEVICAPE_REGISTRY_HOST")}"`,
									`curl -v --insecure ${env("LEVICAPE_REGISTRY")}`,
								]}
							/>
							<GithubStepNodeSetup
								configuration={NodeGhaConfiguration({ env })}
								options={{}}
							>
								{(node) => {
									return (
										<Fragment>
											<GithubStepNodeInstall {...node} />
											<GithubStepNodeScripts {...node} scripts={["build"]} />
											<GithubStepNodeScripts {...node} scripts={["lint"]} />
											<GithubStepNodeScripts {...node} scripts={["test"]} />
										</Fragment>
									);
								}}
							</GithubStepNodeSetup>
							<GithubStepNodeScripts
								configuration={NodeGhaConfiguration({ env })}
								scripts={["prepublishOnly"]}
							/>
							<GithubStep
								name={"Increment version"}
								run={[
									"export PREID=$RELEVANT_SHA",
									"export PREID=${PREID:0:10}",
									`export ARGS="--git-tag-version=false --commit-hooks=false"`,
									`npm version ${_$_("github.event.release.tag_name")}-\${PREID:-unknown}.${_$_("github.run_number")} $ARGS --allow-same-version`,
								]}
								env={{
									RELEVANT_SHA: _$_(
										"github.event.release.target_commitish || github.sha",
									),
								}}
							/>
							<GithubStep
								if={"success()"}
								name={"Publish to npm"}
								continueOnError={true}
								run={["pnpm publish --no-git-checks;"]}
							/>
						</Fragment>
					}
				/>
			);
		};

		let packageScope = props.compileAndPublish?.[0]?.packageName.replace(
			/[^a-zA-Z0-9-_@]/g,
			"_",
		);

		return (
			<GithubWorkflow
				name={`${packageScope ?? "UNKNOWN_PACKAGE"}`}
				on={{
					release: {
						types: ["released"],
					},
				}}
				env={{
					...register("LEVICAPE_REGISTRY_HOST", "npm.pkg.github.com/"),
					...register("LEVICAPE_REGISTRY", "https://npm.pkg.github.com"),
					...register("LEVICAPE_TOKEN", secret("GITHUB_TOKEN")),
				}}
			>
				{props.compileAndPublish
					? props.compileAndPublish.map((props) => (
							<CompileAndPublish {...props} />
						))
					: []}
			</GithubWorkflow>
		);
	}
)({ compileAndPublish });
