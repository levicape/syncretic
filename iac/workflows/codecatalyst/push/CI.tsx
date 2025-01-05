/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { AwsStateBackendCommandsParameter } from "@levicape/fourtwo";
import { CodeCatalystWorkflowExpressions } from "@levicape/fourtwo/ci/cd/pipeline/codecatalyst";
import {
	CodeCatalystActionGroupX,
	CodeCatalystStepX,
	CodeCatalystWorkflowX,
} from "@levicape/fourtwo/x/codecatalyst";
import {
	CodeCatalystBuildX,
	CodeCatalystTestX,
} from "@levicape/fourtwo/x/codecatalyst/actions/aws";

let {
	current: { register, context: _$_, env, secret },
} = CodeCatalystWorkflowExpressions;

let FileCaching = ({
	docker,
	pulumi,
	pnpm,
}: {
	docker?: boolean;
	pulumi?: boolean;
	pnpm?: boolean;
} = {}) => ({
	FileCaching: {
		a64_npm_global: {
			Path: "/tmp/npm-global",
			RestoreKeys: ["npminstall"],
		},
		...(pnpm
			? {
					a64_pnpm_store: {
						Path: "/tmp/pnpm-store",
						RestoreKeys: ["pnpminstall"],
					},
				}
			: {}),
		a64_nx: {
			Path: "/tmp/nx-cache",
			RestoreKeys: ["nx"],
		},
		...(docker
			? {
					a64_docker: {
						Path: "/tmp/docker-cache",
						RestoreKeys: ["docker"],
					},
				}
			: {}),
		...(pulumi
			? {
					a64_pulumi: {
						Path: "/tmp/pulumi",
						RestoreKeys: ["pulumi"],
					},
				}
			: {}),
	},
});

export default async () => (
	<CodeCatalystWorkflowX
		name="main_OnPush__CI_CD"
		runMode={"QUEUED"}
		compute={{
			Type: "EC2",
			Fleet: "Linux.Arm64.XLarge",
			SharedInstance: true,
		}}
		triggers={[
			{
				Type: "PUSH",
				Branches: ["main"],
			},
		]}
	>
		{{
			Integration: (
				<CodeCatalystActionGroupX>
					{{
						Install: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								inputs={{
									Sources: ["WorkflowSource"],
									Variables: [
										register("PAKETO_CLI_IMAGE", "buildpacksio/pack:latest"),
										register("PAKETO_BUILDER_IMAGE", "heroku/builder:24"),
										register("PAKETO_LAUNCHER_IMAGE", "heroku/heroku:24"),
										register("PULUMI_VERSION", "3.144.1"),
										register("NPM_REGISTRY_PROTOCOL", "https"),
										register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
										register(
											"NODE_AUTH_TOKEN",
											_$_("Secrets.GITHUB_LEVICAPE_PAT"),
										),
									],
								}}
								caching={FileCaching({
									docker: true,
									pulumi: true,
									pnpm: true,
								})}
								timeout={5}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX
											run={`npm config set @levicape:registry=${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")} --location project`}
										/>
										<CodeCatalystStepX
											run={`npm config set //${env("NPM_REGISTRY_HOST")}/:_authToken=${env("NODE_AUTH_TOKEN")} --location project`}
										/>
										<CodeCatalystStepX run={`mkdir -p /tmp/pulumi`} />
										<CodeCatalystStepX run={`mkdir -p /tmp/npm-global`} />
										<CodeCatalystStepX run={`mkdir -p /tmp/pnpm-store`} />
										<CodeCatalystStepX
											run={`mkdir -p /tmp/docker-cache/images`}
										/>
										{...[
											["cli-pack.tar", "$PAKETO_CLI_IMAGE"],
											["builder.tar", "$PAKETO_BUILDER_IMAGE"],
											["launcher.tar", "$PAKETO_LAUNCHER_IMAGE"],
										].flatMap(([file, image]) => {
											return (
												<>
													<CodeCatalystStepX
														run={`docker load --input /tmp/docker-cache/images/${file} || true`}
													/>
													<CodeCatalystStepX run={`docker pull ${image}`} />
													<CodeCatalystStepX
														run={`docker save -o /tmp/docker-cache/images/${file} ${image}`}
													/>
												</>
											);
										})}
										<CodeCatalystStepX run="npm root -g" />
										<CodeCatalystStepX run="npm install --g pnpm" />
										<CodeCatalystStepX run="npm install --g n" />
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX run="ls -la /tmp/npm-global/lib/node_modules" />
										<CodeCatalystStepX run="ls -la /tmp/npm-global/lib/node_modules/pnpm || true" />
										<CodeCatalystStepX
											run={"npm exec pnpm config set store-dir /tmp/pnpm-store"}
										/>
										<CodeCatalystStepX run="npm exec pnpm install" />
										<CodeCatalystStepX run="npm exec pnpm list" />
										<CodeCatalystStepX
											run={
												"[ -f /tmp/pulumi/bin/pulumi ] && /tmp/pulumi/bin/pulumi version | grep $PULUMI_VERSION || curl -fsSL https://get.pulumi.com | sh -s -- --version $PULUMI_VERSION --install-root /tmp/pulumi"
											}
										/>
									</>
								}
							/>
						),
						Compile: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								dependsOn={["Install"]}
								caching={FileCaching()}
								timeout={8}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX run="npm exec pnpm compile" />
										<CodeCatalystStepX run="npm exec pnpm lint" />
									</>
								}
							/>
						),
						Test: (
							<CodeCatalystTestX
								architecture={"arm64"}
								dependsOn={["Compile"]}
								caching={FileCaching()}
								timeout={10}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX run="npm exec pnpm test" />
									</>
								}
							/>
						),
					}}
				</CodeCatalystActionGroupX>
			),
			Deployment: (
				<CodeCatalystActionGroupX dependsOn={["Integration"]}>
					{{
						Image: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								caching={FileCaching({ docker: true })}
								timeout={10}
								inputs={{
									Variables: [register("APPLICATION_IMAGE_NAME", "fourtwo")],
								}}
								steps={
									<>
										{...["cli-pack.tar", "builder.tar", "launcher.tar"].flatMap(
											(file) => {
												return (
													<>
														<CodeCatalystStepX
															run={`docker load --input /tmp/docker-cache/images/${file} || true`}
														/>
													</>
												);
											},
										)}
										<CodeCatalystStepX run={`mkdir -p $(pwd)/.artifacts`} />
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX
											run={
												"npm exec pnpm exec nx pack:build iac-images-application --verbose"
											}
										/>
										<CodeCatalystStepX
											run={
												"docker save -o $(pwd)/.artifacts/application.tar $APPLICATION_IMAGE_NAME"
											}
										/>
									</>
								}
							/>
						),
						Preview_current: (
							<CodeCatalystBuildX
								dependsOn={["Image"]}
								architecture={"arm64"}
								caching={FileCaching({ pulumi: true })}
								timeout={10}
								inputs={{
									Variables: [
										register("APPLICATION_IMAGE_NAME", "fourtwo"),
										register("CI_ENVIRONMENT", "current"),
										register("CI_REGION", "us-west-2"),
										register(
											"PULUMI_CONFIG_PASSPHRASE",
											secret("PULUMI_CONFIG_PASSPHRASE"),
										),
										register("PULUMI_HOME", "/tmp/pulumi"),
									],
								}}
								environment={{
									Name: "current",
								}}
								steps={
									<>
										<CodeCatalystStepX
											run={
												"docker load --input $(pwd)/.artifacts/application.tar"
											}
										/>
										<CodeCatalystStepX run={"docker images"} />
										<CodeCatalystStepX
											run={`aws ssm get-parameter --name ${AwsStateBackendCommandsParameter()}`}
										/>
										<CodeCatalystStepX
											run={[
												"docker run --rm",
												"-e CI=true",
												"-e AWS_EXECUTION_ENV",
												"-e AWS_CONTAINER_CREDENTIALS_FULL_URI",
												`--network="host"`,
												"--entrypoint launcher",
												"fourtwo",
												"-- pnpm run dx:cli:mjs aws pulumi ci",
												"--region us-west-2",
												"> .pulumi-ci",
											]
												.map((x) => x.trim())
												.join(" ")}
										/>
										<CodeCatalystStepX
											run={`cat .pulumi-ci | grep "export PULUMI" > .pulumi-ci`}
										/>
										<CodeCatalystStepX run={"cat .pulumi-ci"} />
										<CodeCatalystStepX run={`source .pulumi-ci`} />
										{...[
											"code",
											"domain",
											"environment",
											"platform",
											"schedule",
											"test",
											"website",
										].flatMap((stack) => (
											<>
												<CodeCatalystStepX
													run={
														`/tmp/pulumi/bin/pulumi stack init --secrets-provider $PULUMI_BACKEND_KEY -C iac/stacks/${stack} $APPLICATION_IMAGE_NAME.$CI_ENVIRONMENT.${stack}`
														// "./.pulumi/bin/pulumi -y up -C iac/stacks/bootstrap"
													}
												/>
												<CodeCatalystStepX
													run={
														`/tmp/pulumi/bin/pulumi preview -C iac/stacks/${stack}`
														// "./.pulumi/bin/pulumi -y up -C iac/stacks/bootstrap"
													}
												/>
											</>
										))}
									</>
								}
							/>
						), // Deploy_current, Preview_stable, Approve_stable, Deploy_stable
					}}
				</CodeCatalystActionGroupX>
			),
		}}
	</CodeCatalystWorkflowX>
);
