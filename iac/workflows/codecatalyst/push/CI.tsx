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

let FileCaching = {
	a64_npm_global: {
		Path: "/tmp/npm-global",
		RestoreKeys: ["npminstall"],
	},
	a64_pnpm_store: {
		Path: "/tmp/pnpm-store",
		RestoreKeys: ["pnpminstall"],
	},
	a64_pulumi: {
		Path: "/tmp/pulumi",
		RestoreKeys: ["pulumi"],
	},
	a64_docker: {
		Path: "/tmp/docker-cache",
		RestoreKeys: ["docker"],
	},
	a64_nx: {
		Path: "/tmp/nx-cache",
		RestoreKeys: ["nx"],
	},
};

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
			ci: (
				<CodeCatalystActionGroupX>
					{{
						Install: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								inputs={{
									Sources: ["WorkflowSource"],
									Variables: [
										register("NPM_REGISTRY_PROTOCOL", "https"),
										register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
										register(
											"NODE_AUTH_TOKEN",
											_$_("Secrets.GITHUB_LEVICAPE_PAT"),
										),
									],
								}}
								caching={{
									FileCaching,
								}}
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
										<CodeCatalystStepX run={`mkdir -p /tmp/docker-cache`} />
										<CodeCatalystStepX run={`mkdir -p /.artifacts`} />
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
										<CodeCatalystStepX run="curl -fsSL https://get.pulumi.com | sh -s -- --install-root /tmp/pulumi" />
									</>
								}
							/>
						),
						Compile: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								dependsOn={["Install"]}
								caching={{
									FileCaching,
								}}
								timeout={8}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX
											run={"npm exec pnpm config set store-dir /tmp/pnpm-store"}
										/>
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX run="npm exec pnpm list" />
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
								caching={{
									FileCaching,
								}}
								timeout={10}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX
											run={"npm exec pnpm config set store-dir /tmp/pnpm-store"}
										/>
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX run="npm exec pnpm list" />
										<CodeCatalystStepX run="npm exec pnpm test" />
									</>
								}
							/>
						),
					}}
				</CodeCatalystActionGroupX>
			),
			cd: (
				<CodeCatalystActionGroupX dependsOn={["ci"]}>
					{{
						Image: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								caching={{
									FileCaching,
								}}
								timeout={10}
								inputs={{
									Variables: [register("APPLICATION_IMAGE_NAME", "fourtwo")],
								}}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=/tmp/npm-global"}
										/>
										<CodeCatalystStepX
											run={"npm exec pnpm config set store-dir /tmp/pnpm-store"}
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
								caching={{
									FileCaching,
								}}
								timeout={10}
								inputs={{
									Variables: [
										register("CI_ENVIRONMENT", "current"),
										register("CI_REGION", "us-west-2"),
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
										<CodeCatalystStepX run={"cat .pulumi-ci"} />
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
														`/tmp/pulumi/bin/pulumi stack init $CI_ENVIRONMENT -C iac/stacks/${stack}`
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
