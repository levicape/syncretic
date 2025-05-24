/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { GithubWorkflowExpressions } from "@levicape/fourtwo/ci/cd/pipeline/github/GithubWorkflowExpressions";
import { Fragment } from "@levicape/fourtwo/jsx-runtime";
import { GithubJob } from "@levicape/fourtwo/jsx/github/GithubJob";
import { GithubStep } from "@levicape/fourtwo/jsx/github/GithubStep";
import { GithubWorkflow } from "@levicape/fourtwo/jsx/github/GithubWorkflow";
import { GithubStepCheckout } from "@levicape/fourtwo/jsx/github/steps/GithubStepCheckout";
import { GithubStepNodeInstall } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeInstall";
import { GithubStepNodeScripts } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeScripts";
import { GithubStepNodeSetup } from "@levicape/fourtwo/jsx/github/steps/node/GithubStepNodeSetup";
import { NodeGhaConfiguration } from "../push/CI";

// const enquirer = new Enquirer();
// const prompt = enquirer.prompt.bind(enquirer);

export default async () => {
	let {
		current: { register, context: _$_, env },
	} = GithubWorkflowExpressions;
	return (
		<GithubWorkflow
			name="dispatch: RUNNER:publish:npm"
			on={{
				workflow_dispatch: {
					inputs: {
						runner: {
							required: true,
							type: "string",
							description: "The runner to use for the job",
						},
						registry_host: {
							required: true,
							type: "string",
							description: "The target registry host to publish to",
						},
						registry_protocol: {
							required: true,
							type: "string",
						},
						registry_secret_env: {
							required: false,
							description: "Name of env var for the target registry secret",
							type: "string",
						},
					},
				},
			}}
			env={{
				...register("NPM_REGISTRY_PROTOCOL", "https"),
				...register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
				...register("PACKAGE_JSON_NAME", "@levicape/fourtwo"),
			}}
		>
			<GithubJob
				id={"select"}
				name={"Select registry from event inputs"}
				runsOn={"ubuntu-latest"}
				packages="read"
				contents="read"
				outputs={{
					runner: _$_("github.event.inputs.runner"),
					registry_host: _$_("github.event.inputs.registry_host"),
					registry_protocol: _$_("github.event.inputs.registry_protocol"),
					registry_secret: env("[github.event.inputs.registry_secret_env]"),
					package_name: env("PACKAGE_JSON_NAME"),
				}}
				steps={[
					<GithubStep
						name={"Select registry from event inputs"}
						run={[
							`export REGISTRY_SECRET="$${_$_("github.event.inputs.registry_secret_env")}"`,
							`echo "::set-output name=runner::${_$_("github.event.inputs.runner")}"`,
							`echo "::set-output name=registry_host::${_$_("github.event.inputs.registry_host")}"`,
							`echo "::set-output name=registry_protocol::${_$_("github.event.inputs.registry_protocol")}"`,
							`echo "::set-output name=registry_secret::$REGISTRY_SECRET"`,
							`echo "::set-output name=package_name::${env("PACKAGE_JSON_NAME")}"`,
							`echo "registry_host: ${_$_("github.event.inputs.registry_host")}"`,
							`echo "registry_protocol: ${_$_("github.event.inputs.registry_protocol")}"`,
							`echo "registry_secret: ${_$_("github.event.inputs.registry_secret_env")}"`,
							`echo "package_name: ${env("PACKAGE_JSON_NAME")}"`,
						]}
					/>,
				]}
			/>
			<GithubJob
				id="packages"
				needs={["select"]}
				name="Publish to registry"
				runsOn={_$_("needs.select.outputs.runner")}
				packages="read"
				contents="read"
				steps={
					<>
						<GithubStep
							name={"Verify registry URL"}
							continueOnError={true}
							run={[
								`echo "NPM_REGISTRY_URL: ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}"`,
								`curl -v --insecure ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}`,
							]}
						/>
						<GithubStepCheckout />
						<GithubStepNodeSetup configuration={NodeGhaConfiguration({ env })}>
							{(node) => {
								return (
									<>
										<GithubStepNodeInstall {...node} />
										<GithubStep
											name={"Set version to latest in registry"}
											continueOnError={true}
											run={[
												`pnpm version $(npm view ${_$_("needs.select.outputs.package_name")} version)--no-git-tag-version --no-git-checks`,
											]}
											env={{
												NODE_NO_WARNINGS: "1",
											}}
										/>
									</>
								);
							}}
						</GithubStepNodeSetup>
						<GithubStepNodeSetup
							configuration={{
								...NodeGhaConfiguration({ env }),
								packageManager: {
									...NodeGhaConfiguration({ env }).packageManager,
									cache: false,
								},
								registry: {
									host: `${_$_("needs.select.outputs.registry_protocol")}://${_$_("needs.select.outputs.registry_host")}`,
									scope: NodeGhaConfiguration({ env }).registry.scope,
									secret: `[needs.select.outputs.registry_secret]`,
								},
							}}
						>
							{(node) => {
								return (
									<Fragment>
										<GithubStepNodeScripts
											{...node}
											scripts={["prepublishOnly"]}
										/>
									</Fragment>
								);
							}}
						</GithubStepNodeSetup>
					</>
				}
			/>
		</GithubWorkflow>
	);
};
