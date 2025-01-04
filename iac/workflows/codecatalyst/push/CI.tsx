/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

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
									FileCaching: {
										a64_npm_global: {
											Path: ".npm-global",
											RestoreKeys: ["npminstall"],
										},
										a64_pnpm_store: {
											Path: ".pnpm-store",
											RestoreKeys: ["pnpminstall"],
										},
										a64_pulumi: {
											Path: ".pulumi",
											RestoreKeys: ["pulumi"],
										},
									},
								}}
								timeout={5}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=$(pwd)/.npm-global"}
										/>
										<CodeCatalystStepX
											run={`npm config set @levicape:registry=${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")} --location project`}
										/>
										<CodeCatalystStepX
											run={`npm config set //${env("NPM_REGISTRY_HOST")}/:_authToken=${env("NODE_AUTH_TOKEN")} --location project`}
										/>
										<CodeCatalystStepX run={`mkdir -p ./.pulumi`} />
										<CodeCatalystStepX run={`mkdir -p ./.npm-global`} />
										<CodeCatalystStepX run={`mkdir -p ./.pnpm-store`} />
										<CodeCatalystStepX run="npm root -g" />
										<CodeCatalystStepX run="npm install --g pnpm" />
										<CodeCatalystStepX run="npm install --g n" />
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX run="ls -la ./.npm-global/lib/node_modules" />
										<CodeCatalystStepX run="ls -la ./.npm-global/lib/node_modules/pnpm || true" />
										<CodeCatalystStepX
											run={
												"npm exec pnpm config set store-dir $(pwd)/.pnpm-store"
											}
										/>
										<CodeCatalystStepX run="npm exec pnpm install" />
										<CodeCatalystStepX run="npm exec pnpm list" />
										<CodeCatalystStepX run="curl -fsSL https://get.pulumi.com | sh -s -- --install-root $(pwd)/.pulumi" />
									</>
								}
							/>
						),
						Compile: (
							<CodeCatalystBuildX
								architecture={"arm64"}
								dependsOn={["Install"]}
								timeout={8}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=$(pwd)/.npm-global"}
										/>
										<CodeCatalystStepX
											run={
												"npm exec pnpm config set store-dir $(pwd)/.pnpm-store"
											}
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
								timeout={10}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=$(pwd)/.npm-global"}
										/>
										<CodeCatalystStepX
											run={
												"npm exec pnpm config set store-dir $(pwd)/.pnpm-store"
											}
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
								timeout={10}
								steps={
									<>
										<CodeCatalystStepX
											run={"npm config set prefix=$(pwd)/.npm-global"}
										/>
										<CodeCatalystStepX
											run={
												"npm exec pnpm config set store-dir $(pwd)/.pnpm-store"
											}
										/>
										<CodeCatalystStepX run="npm exec n 22" />
										<CodeCatalystStepX
											run={
												"npm exec pnpm exec nx pack:build iac-images-application --verbose"
											}
										/>
										<CodeCatalystStepX run="export CREDENTIALS_PORT=$(echo $AWS_CONTAINER_CREDENTIALS_FULL_URI | awk -F':' '{print $3}')" />
										<CodeCatalystStepX run="export CREDENTIALS_PORT=$(echo $CREDENTIALS_PORT | awk -F'/' '{print $1}')" />
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
											]
												.map((x) => x.trim())
												.join(" ")}
										/>
									</>
								}
							/>
						),
						Preview_current: (
							<CodeCatalystBuildX
								dependsOn={["Image"]}
								architecture={"arm64"}
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
										<CodeCatalystStepX run="export CREDENTIALS_PORT=$(echo $AWS_CONTAINER_CREDENTIALS_FULL_URI | awk -F':' '{print $3}')" />
										<CodeCatalystStepX run="export CREDENTIALS_PORT=$(echo $CREDENTIALS_PORT | awk -F'/' '{print $1}')" />
										<CodeCatalystStepX
											run={[
												"docker run --rm",
												"-e CI=true",
												"-e AWS_EXECUTION_ENV",
												"-e AWS_CONTAINER_TOKEN_ENDPOINT",
												"-e AWS_CONTAINER_CREDENTIALS_FULL_URI",
												`--network="host"`,
												"--entrypoint launcher",
												"fourtwo",
												"-- pnpm run dx:cli:mjs aws pulumi ci",
												"--region us-west-2",
												" > .pulumi-ci",
											]
												.map((x) => x.trim())
												.join(" ")}
										/>
										<CodeCatalystStepX run={"cat .pulumi-ci"} />
										<CodeCatalystStepX run={"docker images"} />
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
														`./.pulumi/bin/pulumi stack init $CI_ENVIRONMENT -C iac/stacks/${stack}`
														// "./.pulumi/bin/pulumi -y up -C iac/stacks/bootstrap"
													}
												/>
												<CodeCatalystStepX
													run={
														`./.pulumi/bin/pulumi preview -C iac/stacks/${stack}`
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
