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
		name="onPush_Test-Package"
		runMode={"PARALLEL"}
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
										},
										a64_pnpm_store: {
											Path: ".pnpm-store",
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
			image: (
				<CodeCatalystActionGroupX dependsOn={["ci"]}>
					{{
						Build: (
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
										<CodeCatalystStepX run="npm exec pnpm install" />
										<CodeCatalystStepX run="npm exec pnpm list" />
										<CodeCatalystStepX run="npm exec pnpm exec nx pack:build iac-images-application --verbose" />
										<CodeCatalystStepX run="docker run --rm -e CI=true --entrypoint launcher fourtwo -- pnpm run dx:cli:mjs aws pulumi ci" />
									</>
								}
							/>
						),
					}}
				</CodeCatalystActionGroupX>
			),
		}}
	</CodeCatalystWorkflowX>
);
