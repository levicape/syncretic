/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { AwsStateBackendCommandsParameter } from "@levicape/fourtwo";
import { CodeCatalystWorkflowExpressions } from "@levicape/fourtwo/ci/cd/pipeline/codecatalyst";
import {
	CodeCatalystActionGroupX,
	CodeCatalystStepX,
	CodeCatalystWorkflowX,
} from "@levicape/fourtwo/x/codecatalyst";
import { CodeCatalystBuildX } from "@levicape/fourtwo/x/codecatalyst/actions/aws";

let FileCaching = ({
	docker,
	pulumi,
}: {
	docker?: boolean;
	pulumi?: boolean;
} = {}) => ({
	FileCaching: {
		a64_npm_global: {
			Path: "/tmp/npm-global",
			RestoreKeys: ["npminstall"],
		},
		...{
			a64_pnpm_store: {
				Path: "/tmp/pnpm-store",
				RestoreKeys: ["pnpminstall"],
			},
		},
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

export const PULUMI_CACHE = FileCaching({ pulumi: true }).FileCaching
	.a64_pulumi!.Path;

export const NPM_GLOBAL_CACHE = FileCaching().FileCaching.a64_npm_global.Path;

export const PNP_STORE = FileCaching().FileCaching.a64_pnpm_store.Path;

export const DOCKER_CACHE = FileCaching({ docker: true }).FileCaching
	.a64_docker!.Path;

export const ALL_CACHES = Object.values(
	FileCaching({ docker: true, pulumi: true }),
).flatMap((cache) => Object.values(cache).map((cache) => cache.Path));

export const DOCKER_IMAGES = [
	["cli-pack.tar.gz", "$PAKETO_CLI_IMAGE"],
	["builder.tar.gz", "$PAKETO_BUILDER_IMAGE"],
	["launcher.tar.gz", "$PAKETO_LAUNCHER_IMAGE"],
] as const;

export const OUTPUT_IMAGE_PATH = "_images" as const;

export const OUTPUT_IMAGES = [
	["application.tar.gz", "$APPLICATION_IMAGE_NAME"],
] as const;

export const PULUMI_STACKS = [
	"code",
	// "domain",
	// "environment",
	// "platform",
	// "schedule",
	// "test",
	// "website",
] as const;

export default async () => {
	let {
		current: { register, context: _$_, env, secret },
	} = CodeCatalystWorkflowExpressions;

	return (
		<CodeCatalystWorkflowX
			name="main_OnPush__CI_CD"
			runMode={"SUPERSEDED"}
			compute={{
				Type: "EC2",
				Fleet: "Linux.Arm64.2XLarge",
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
											register("NPM_REGISTRY_PROTOCOL", "https"),
											register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
											register("PULUMI_VERSION", "3.144.1"),
											register(
												"NODE_AUTH_TOKEN",
												_$_("Secrets.GITHUB_LEVICAPE_PAT"),
											),
										],
									}}
									caching={FileCaching({
										docker: true,
										pulumi: true,
									})}
									timeout={9}
									steps={
										<>
											<CodeCatalystStepX
												run={`npm config set @levicape:registry=${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")} --location project`}
											/>
											<CodeCatalystStepX
												run={`npm config set //${env("NPM_REGISTRY_HOST")}/:_authToken=${env("NODE_AUTH_TOKEN")} --location project`}
											/>
											<CodeCatalystStepX
												run={`npm config set prefix=${NPM_GLOBAL_CACHE}`}
											/>
											<CodeCatalystStepX run="npm root -g" />
											{["pnpm", "n"].map((pkg: string) => (
												<CodeCatalystStepX run={`npm install --g ${pkg}`} />
											))}
											<CodeCatalystStepX run="npm exec n 22" />
											<CodeCatalystStepX
												run={`npm exec pnpm config set store-dir ${PNP_STORE}`}
											/>
											<CodeCatalystStepX run="npm exec pnpm install" />
											{...[...ALL_CACHES, `${DOCKER_CACHE}/images`].flatMap(
												(cache) => {
													return (
														<>
															<CodeCatalystStepX run={`mkdir -p ${cache}`} />
														</>
													);
												},
											)}
											{...DOCKER_IMAGES.flatMap(([file, image]) => {
												return (
													<>
														<CodeCatalystStepX
															run={`docker load --input ${DOCKER_CACHE}/images/${file} || true`}
														/>
														<CodeCatalystStepX run={`docker pull ${image}`} />
														<CodeCatalystStepX
															run={`docker save ${image} | gzip > ${DOCKER_CACHE}/images/${file}`}
														/>
														<CodeCatalystStepX
															run={`du -sh ${DOCKER_CACHE}/images/${file}`}
														/>
													</>
												);
											})}
											<CodeCatalystStepX
												run={`[ -f ${PULUMI_CACHE}/bin/pulumi ] && ${PULUMI_CACHE}/bin/pulumi version | grep $PULUMI_VERSION || curl -fsSL https://get.pulumi.com | sh -s -- --version $PULUMI_VERSION --install-root ${PULUMI_CACHE}`}
											/>
											<CodeCatalystStepX run={`du -sh ${PULUMI_CACHE}`} />
											<CodeCatalystStepX run="npm exec pnpm list" />
											<CodeCatalystStepX
												run={`du -sh node_modules ${NPM_GLOBAL_CACHE} ${PNP_STORE}`}
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
									inputs={{
										Sources: ["WorkflowSource"],
									}}
									outputs={{
										AutoDiscoverReports: {
											Enabled: true,
											ReportNamePrefix: "junit",
										},
									}}
									timeout={8}
									steps={
										<>
											<CodeCatalystStepX
												run={`npm config set prefix=${NPM_GLOBAL_CACHE}`}
											/>
											<CodeCatalystStepX run="npm exec n 22" />
											<CodeCatalystStepX
												run={`npm exec pnpm config set store-dir ${PNP_STORE}`}
											/>
											<CodeCatalystStepX run="npm exec pnpm install --prefer-offline" />
											<CodeCatalystStepX run="npm exec pnpm compile" />
											<CodeCatalystStepX run="npm exec pnpm lint" />
											<CodeCatalystStepX run="npm exec pnpm test" />
											<CodeCatalystStepX
												run={`du -sh $(pwd)/**/module $(pwd)/**/commonjs || true`}
											/>
										</>
									}
								/>
							),
							Image: (
								<CodeCatalystBuildX
									dependsOn={["Install"]}
									architecture={"arm64"}
									caching={FileCaching({ docker: true })}
									timeout={10}
									inputs={{
										Sources: ["WorkflowSource"],
										Variables: [register("APPLICATION_IMAGE_NAME", "fourtwo")],
									}}
									outputs={{
										Artifacts: [
											{ Name: "images", Files: [`${OUTPUT_IMAGE_PATH}/**/*`] },
										],
									}}
									steps={
										<>
											{...DOCKER_IMAGES.map(([path]) => path).flatMap(
												(file) => {
													return (
														<>
															<CodeCatalystStepX
																run={`docker load --input ${DOCKER_CACHE}/images/${file} || true`}
															/>
														</>
													);
												},
											)}
											<CodeCatalystStepX
												run={`mkdir -p ${OUTPUT_IMAGE_PATH}`}
											/>
											<CodeCatalystStepX
												run={`npm config set prefix=${NPM_GLOBAL_CACHE}`}
											/>
											<CodeCatalystStepX run="npm exec n 22" />
											<CodeCatalystStepX
												run={`npm exec pnpm config set store-dir ${PNP_STORE}`}
											/>
											<CodeCatalystStepX run="npm exec pnpm install --prefer-offline" />
											<CodeCatalystStepX
												run={
													"npm exec pnpm exec nx pack:build iac-images-application --verbose"
												}
											/>
											{...OUTPUT_IMAGES.flatMap(([file, image]) => {
												return (
													<>
														<CodeCatalystStepX
															run={`docker save ${image} | gzip > ${OUTPUT_IMAGE_PATH}/${file}`}
														/>
														<CodeCatalystStepX
															run={`du -sh ${OUTPUT_IMAGE_PATH}/${file}`}
														/>
													</>
												);
											})}
											<CodeCatalystStepX run={`ls -la ${OUTPUT_IMAGE_PATH}`} />
										</>
									}
								/>
							),
							Preview: (
								<CodeCatalystBuildX
									dependsOn={["Image"]}
									architecture={"arm64"}
									caching={FileCaching({ pulumi: true })}
									timeout={10}
									inputs={{
										Sources: ["WorkflowSource"],
										Variables: [
											register("APPLICATION_IMAGE_NAME", "fourtwo"),
											register("BRANCH_NAME", _$_("BranchName")),
											register("COMMIT_ID", _$_("CommitId")),
											register("CI_ENVIRONMENT", "current"),
											register("AWS_REGION", "us-west-2"),
											register("PULUMI_HOME", PULUMI_CACHE),
											register(
												"PULUMI_CONFIG_PASSPHRASE",
												secret("PULUMI_CONFIG_PASSPHRASE"),
											),
										],
										Artifacts: ["images"],
									}}
									environment={{
										Name: "current",
									}}
									steps={
										<>
											<CodeCatalystStepX
												run={`npm config set prefix=${NPM_GLOBAL_CACHE}`}
											/>
											<CodeCatalystStepX
												run={`npm exec pnpm config set store-dir ${PNP_STORE}`}
											/>
											<CodeCatalystStepX run="npm exec n 22" />
											<CodeCatalystStepX run="npm exec pnpm install --prefer-offline" />
											<CodeCatalystStepX
												run={`ls -la $CATALYST_SOURCE_DIR${OUTPUT_IMAGE_PATH}/${OUTPUT_IMAGE_PATH}`}
											/>
											{...OUTPUT_IMAGES.map(([file]) => (
												<CodeCatalystStepX
													run={`docker load --input $CATALYST_SOURCE_DIR${OUTPUT_IMAGE_PATH}/${OUTPUT_IMAGE_PATH}/${file}`}
												/>
											))}
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
													"--region $AWS_REGION",
													"> .pulumi-ci",
												]
													.map((x) => x.trim())
													.join(" ")}
											/>
											<CodeCatalystStepX run={"cat .pulumi-ci"} />
											<CodeCatalystStepX
												run={`cat .pulumi-ci | grep "export" >> .export-cd`}
											/>
											<CodeCatalystStepX run={"cat .export-cd"} />
											<CodeCatalystStepX run={`source .export-cd`} />
											{...PULUMI_STACKS.flatMap((stack) => (
												<>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack init $APPLICATION_IMAGE_NAME.$CI_ENVIRONMENT.${stack} -C $(pwd)/iac/stacks/${stack} || true`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack select $APPLICATION_IMAGE_NAME.$CI_ENVIRONMENT.${stack} -C $(pwd)/iac/stacks/${stack} || true`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi config set aws:skipMetadataApiCheck false -C $(pwd)/iac/stacks/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack change-secrets-provider $AWS_PROVIDER_KEY -C $(pwd)/iac/stacks/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi preview -C $(pwd)/iac/stacks/${stack}  --show-replacement-steps --json --suppress-progress --non-interactive --diff --message "$BRANCH_NAME-$COMMIT_ID"`}
													/>
												</>
											))}
											{...PULUMI_STACKS.flatMap((stack) => (
												<>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi up -C $(pwd)/iac/stacks/${stack} --yes --suppress-progress --non-interactive --diff --message "$BRANCH_NAME-$COMMIT_ID"`}
													/>
												</>
											))}
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
};
