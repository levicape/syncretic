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

const APPLICATION = "fourtwo";
const PUSH_IMAGE_ECR_STACK_OUTPUT = "fourtwo_codestar_ecr";
let FileCaching = ({
	docker,
	pulumi,
	python,
}: {
	docker?: boolean;
	pulumi?: boolean;
	python?: boolean;
} = {}) => ({
	FileCaching: {
		...{
			a64_nodejs: {
				Path: "/cc/cache/nodejs",
				RestoreKeys: ["nodejs"],
			},
		},
		...(docker
			? {
					a64_docker: {
						Path: "/cc/cache/docker",
						RestoreKeys: ["docker"],
					},
				}
			: {}),
		...(pulumi
			? {
					a64_pulumi: {
						Path: "/cc/cache/pulumi",
						RestoreKeys: ["pulumi"],
					},
				}
			: {}),
		...(python
			? {
					a64_python: {
						Path: "/cc/cache/pyenv",
						RestoreKeys: ["python"],
					},
				}
			: {}),
	},
});

export const PULUMI_CACHE = FileCaching({ pulumi: true }).FileCaching.a64_pulumi
	?.Path as string;

export const COREPACK_GLOBAL_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/corepack`;
export const NPM_GLOBAL_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/npm`;
export const PNPM_DLX_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/pnpmcache`;
export const PNPM_STORE_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/addressable`;
export const PNPM_GLOBAL_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/pnpmglobal`;
export const NX_CACHE_DIR = `${FileCaching().FileCaching.a64_nodejs.Path}/nxcache`;

const NODEJS_CACHES = [
	COREPACK_GLOBAL_CACHE,
	NPM_GLOBAL_CACHE,
	PNPM_DLX_CACHE,
	PNPM_STORE_CACHE,
	PNPM_GLOBAL_CACHE,
	NX_CACHE_DIR,
];

export const DOCKER_CACHE = FileCaching({ docker: true }).FileCaching.a64_docker
	?.Path as string;

export const PYENV_ROOT = FileCaching({ python: true }).FileCaching.a64_python
	?.Path;

export const ALL_CACHES = Object.values(
	FileCaching({ docker: true, pulumi: true }),
).flatMap((cache) => Object.values(cache).map((cache) => cache.Path));

export const DOCKER_IMAGES = [
	["cli-pack.tar.gz", "$PAKETO_CLI_IMAGE"],
	["builder.tar.gz", "$PAKETO_BUILDER_IMAGE"],
	["launcher.tar.gz", "$PAKETO_LAUNCHER_IMAGE"],
] as const;

export const OUTPUT_IMAGES_PATH = "_images" as const;
export const OUTPUT_PULUMI_PATH = "_pulumi" as const;

export const OUTPUT_IMAGES = [
	["application.tar.gz", "$APPLICATION_IMAGE_NAME"],
] as const;

type Stack = {
	stack: string;
	output: string;
	name?: string;
};
export const PULUMI_STACKS: Stack[] = [
	{
		stack: "codestar",
	},
	{
		stack: "datalayer",
	},
	{
		stack: "domains/panel/http",
		name: "panel-http",
	},
	{
		stack: "domains/panel/web",
		name: "panel-web",
	},
	// "wwwroot"
].map((stack) => ({ ...stack, output: stack.stack.replaceAll("/", "_") }));

const input = (name: `_${string}`) => `$CATALYST_SOURCE_DIR${name}/${name}`;

export default async () => {
	let {
		current: { register, context: _$_, env, secret },
	} = CodeCatalystWorkflowExpressions;

	const PNPM_ENVIRONMENT = [
		register("COREPACK_HOME", COREPACK_GLOBAL_CACHE),
		register("PNPM_VERSION", "pnpm@9.15.4"),
		register("NODEJS_VERSION", "22.12.0"),
		register("NODE_AUTH_TOKEN", _$_("Secrets.GITHUB_LEVICAPE_PAT")),
		register("NPM_REGISTRY_PROTOCOL", "https"),
		register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
		register("NX_CACHE_DIRECTORY", NX_CACHE_DIR),
	];

	const PULUMI_ENVIRONMENT = [
		register("AWS_REGION", "us-west-2"),
		register("FRONTEND_HOSTNAME", "fourtwo.levicape.cloud"),
		register("PULUMI_CONFIG_PASSPHRASE", secret("PULUMI_CONFIG_PASSPHRASE")),
		register("PULUMI_HOME", PULUMI_CACHE),
		register("PULUMI_VERSION", "3.147.0"),
	];

	const PYTHON_ENVIRONMENT = [
		register("PYTHON", `${PYENV_ROOT}/shims/python3`),
		register("PYENV_ROOT", PYENV_ROOT as string),
		register("PYTHON_VERSION", "3.11.6"),
	];

	const PAKETO_ENVIRONMENT = [
		register("PAKETO_CLI_IMAGE", "buildpacksio/pack:latest"),
		register("PAKETO_BUILDER_IMAGE", "heroku/builder:24"),
		register("PAKETO_LAUNCHER_IMAGE", "heroku/heroku:24"),
	];

	const PNPM_NODE_INSTALL_STEPS = (
		<>
			<CodeCatalystStepX
				run={`npm config set @levicape:registry=${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")} --location project`}
			/>
			<CodeCatalystStepX
				run={`npm config set //${env("NPM_REGISTRY_HOST")}/:_authToken=${env("NODE_AUTH_TOKEN")} --location project`}
			/>
			{...(
				<>
					{["sudo ", ""]
						.flatMap((su) => [
							`${su}npm config set prefix=${NPM_GLOBAL_CACHE}`,
							`${su}corepack -g install $PNPM_VERSION`,
							`${su}corepack enable pnpm`,
							`${su}pnpm config set cache-dir ${PNPM_DLX_CACHE}`,
							`${su}pnpm config set global-dir ${PNPM_GLOBAL_CACHE}`,
							`${su}pnpm config set store-dir ${PNPM_STORE_CACHE}`,
							`${su}pnpx n $NODEJS_VERSION`,
						])
						.flatMap((run) => (
							<CodeCatalystStepX run={run} />
						))}
				</>
			)}
		</>
	);

	const MAKE_DEPENDENCY_INSTALL_STEPS = [
		"make cmake zip unzip automake autoconf",
		"zlib bzip2",
		"g++ libcurl-devel libtool",
		"protobuf protobuf-devel protobuf-compiler",
		"sqlite sqlite-devel sqlite-libs sqlite-tools",
		"jq",
	].map((dependency) => (
		<CodeCatalystStepX run={`sudo yum install -y ${dependency} || true`} />
	));

	return (
		<CodeCatalystWorkflowX
			name="main_OnPush__CI_CD"
			runMode={"SUPERSEDED"}
			compute={{
				Type: "EC2",
				Fleet: "Linux.Arm64.XLarge",
			}}
			triggers={[
				{
					Type: "PUSH",
					Branches: ["main"],
				},
				{
					Type: "SCHEDULE",
					Expression: "0 0 * * ? *",
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
											...PNPM_ENVIRONMENT,
											...PULUMI_ENVIRONMENT,
											...PYTHON_ENVIRONMENT,
											...PAKETO_ENVIRONMENT,
										],
									}}
									caching={FileCaching({
										docker: true,
										pulumi: true,
										python: true,
									})}
									timeout={19}
									steps={
										<>
											{...[
												...ALL_CACHES,
												...NODEJS_CACHES,
												`${DOCKER_CACHE}/images`,
											].flatMap((cache) => (
												<>
													<CodeCatalystStepX run={`mkdir -p ${cache}`} />
												</>
											))}
											{/* Node */}
											{...PNPM_NODE_INSTALL_STEPS}
											<CodeCatalystStepX run="sudo npm root -g" />
											<CodeCatalystStepX run="pnpm install --ignore-scripts" />
											<CodeCatalystStepX run="echo $PNPM_HOME" />
											<CodeCatalystStepX run="pnpm list" />
											{...["node_modules", ...NODEJS_CACHES].flatMap(
												(cache) => (
													<>
														<CodeCatalystStepX
															run={`du -sh ${cache} || true`}
														/>
														<CodeCatalystStepX
															run={`ls -la ${cache} || true `}
														/>
													</>
												),
											)}
											{/* Python */}
											<CodeCatalystStepX run="curl -fsSL https://pyenv.run | bash || true" />
											<CodeCatalystStepX run='[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"' />
											<CodeCatalystStepX run="which pyenv || true" />
											<CodeCatalystStepX
												run={'eval "$(pyenv init - || true)"'}
											/>
											<CodeCatalystStepX run="git clone https://github.com/pyenv/pyenv-update.git $(pyenv root)/plugins/pyenv-update || true" />
											<CodeCatalystStepX run="pyenv update || true" />
											<CodeCatalystStepX run="pyenv install $PYTHON_VERSION || true" />
											<CodeCatalystStepX run="pyenv global $PYTHON_VERSION || true" />
											<CodeCatalystStepX run="pyenv versions || true" />
											<CodeCatalystStepX run="du -sh $PYENV_ROOT" />
											<CodeCatalystStepX run="python3 -m pip install -r requirements.txt" />
											{/* Docker */}
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
															run={`du -sh ${DOCKER_CACHE}/images/${file} || true`}
														/>
													</>
												);
											})}
											{/* Pulumi */}
											<CodeCatalystStepX
												run={`[ -f ${PULUMI_CACHE}/bin/pulumi ] && ${PULUMI_CACHE}/bin/pulumi version | grep $PULUMI_VERSION || curl -fsSL https://get.pulumi.com | sh -s -- --version $PULUMI_VERSION --install-root ${PULUMI_CACHE}`}
											/>
											<CodeCatalystStepX run={`du -sh ${PULUMI_CACHE}`} />
										</>
									}
								/>
							),
							Compile: (
								<CodeCatalystBuildX
									architecture={"arm64"}
									dependsOn={["Install"]}
									caching={FileCaching({
										python: true,
									})}
									inputs={{
										Sources: ["WorkflowSource"],
										Variables: [...PNPM_ENVIRONMENT, ...PYTHON_ENVIRONMENT],
									}}
									outputs={{
										AutoDiscoverReports: {
											Enabled: true,
											ReportNamePrefix: "junit",
										},
									}}
									timeout={19}
									steps={
										<>
											{...PNPM_NODE_INSTALL_STEPS}
											<CodeCatalystStepX run="pnpm install --prefer-offline --ignore-scripts" />
											{...MAKE_DEPENDENCY_INSTALL_STEPS.flatMap(
												(dependency) => <></>,
											)}
											<CodeCatalystStepX
												run={`python3 -c "print('ok')" || true`}
											/>
											<CodeCatalystStepX run="pnpm rebuild || true" />
											<CodeCatalystStepX run="pnpm build" />
											<CodeCatalystStepX run="pnpm lint" />
											<CodeCatalystStepX run="pnpm test" />
											{["module", "commonjs", "gen", "output"].map((path) => (
												<CodeCatalystStepX
													run={`du -sh $(pwd)/**/${path} || true`}
												/>
											))}
										</>
									}
								/>
							),
							Image: (
								<CodeCatalystBuildX
									dependsOn={["Install"]}
									architecture={"arm64"}
									caching={FileCaching({ docker: true, python: true })}
									timeout={19}
									inputs={{
										Sources: ["WorkflowSource"],
										Variables: [
											...PNPM_ENVIRONMENT,
											...PYTHON_ENVIRONMENT,
											register("APPLICATION_IMAGE_NAME", APPLICATION),
										],
									}}
									outputs={{
										Artifacts: [
											{ Name: "images", Files: [`${OUTPUT_IMAGES_PATH}/**/*`] },
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
											{...PNPM_NODE_INSTALL_STEPS}
											<CodeCatalystStepX run="pnpm install --prefer-offline --ignore-scripts" />
											{...MAKE_DEPENDENCY_INSTALL_STEPS}
											<CodeCatalystStepX run="pnpm rebuild || true" />
											<CodeCatalystStepX
												run={
													"pnpm exec nx pack:build iac-images-application --verbose"
												}
											/>
											<CodeCatalystStepX
												run={`mkdir -p ${OUTPUT_IMAGES_PATH}`}
											/>
											{...OUTPUT_IMAGES.flatMap(([file, image]) => {
												return (
													<>
														<CodeCatalystStepX
															run={`docker save ${image} | gzip > ${OUTPUT_IMAGES_PATH}/${file}`}
														/>
														<CodeCatalystStepX
															run={`du -sh ${OUTPUT_IMAGES_PATH}/${file}`}
														/>
													</>
												);
											})}
											<CodeCatalystStepX run={`ls -la ${OUTPUT_IMAGES_PATH}`} />
										</>
									}
								/>
							),
							Current: (
								<CodeCatalystBuildX
									dependsOn={["Image"]}
									architecture={"arm64"}
									caching={FileCaching({ pulumi: true })}
									timeout={19}
									inputs={{
										Sources: ["WorkflowSource"],
										Variables: [
											...PNPM_ENVIRONMENT,
											...PULUMI_ENVIRONMENT,
											register("APPLICATION_IMAGE_NAME", APPLICATION),
											register("CI_ENVIRONMENT", "current"),
										],
										Artifacts: ["images"],
									}}
									outputs={{
										Artifacts: [
											{ Name: "pulumi", Files: [`${OUTPUT_PULUMI_PATH}/**/*`] },
										],
									}}
									environment={{
										Name: "current",
									}}
									steps={
										<>
											{...PNPM_NODE_INSTALL_STEPS}
											<CodeCatalystStepX run="pnpm install --prefer-offline --ignore-scripts" />
											<CodeCatalystStepX run="pnpm build" />
											<CodeCatalystStepX
												run={`ls -la $CATALYST_SOURCE_DIR${OUTPUT_IMAGES_PATH}/${OUTPUT_IMAGES_PATH}`}
											/>
											{...OUTPUT_IMAGES.map(([file]) => (
												<CodeCatalystStepX
													run={`docker load --input $CATALYST_SOURCE_DIR${OUTPUT_IMAGES_PATH}/${OUTPUT_IMAGES_PATH}/${file}`}
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
											<CodeCatalystStepX run={`mkdir ${OUTPUT_PULUMI_PATH}`} />
											{...PULUMI_STACKS.flatMap(({ stack, name, output }) => (
												<>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack init "$APPLICATION_IMAGE_NAME-${name ?? stack}.$CI_ENVIRONMENT" -C $(pwd)/iac/stacks/src/${stack} || true`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack select "$APPLICATION_IMAGE_NAME-${name ?? stack}.$CI_ENVIRONMENT" -C $(pwd)/iac/stacks/src/${stack} || true`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi config set aws:skipMetadataApiCheck false -C $(pwd)/iac/stacks/src/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi config set --path context:stack.environment.isProd false -C $(pwd)/iac/stacks/src/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi config set --path context:stack.environment.features aws -C $(pwd)/iac/stacks/src/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi config set --path 'frontend:stack.dns.hostnames[0]' "$CI_ENVIRONMENT.$APPLICATION_IMAGE_NAME.cloud.$FRONTEND_HOSTNAME" -C $(pwd)/iac/stacks/src/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack change-secrets-provider $AWS_PROVIDER_KEY -C $(pwd)/iac/stacks/src/${stack}`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi refresh -C $(pwd)/iac/stacks/src/${stack} --yes --skip-preview --clear-pending-creates --json --suppress-progress --non-interactive --diff --message "${_$_("WorkflowSource.BranchName")}-${_$_("WorkflowSource.CommitId")}-refresh"`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi preview -C $(pwd)/iac/stacks/src/${stack}  --show-replacement-steps --json --suppress-progress --non-interactive --diff --message "${_$_("WorkflowSource.BranchName")}-${_$_("WorkflowSource.CommitId")}-preview"`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi up -C $(pwd)/iac/stacks/src/${stack} --yes --suppress-progress --non-interactive --diff --message "${_$_("WorkflowSource.BranchName")}-${_$_("WorkflowSource.CommitId")}-up"`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack output -C $(pwd)/iac/stacks/src/${stack} --json > $(pwd)/${OUTPUT_PULUMI_PATH}/${output}.json`}
													/>
													<CodeCatalystStepX
														run={`cat ${OUTPUT_PULUMI_PATH}/${output}.json`}
													/>
													<CodeCatalystStepX
														run={`${PULUMI_CACHE}/bin/pulumi stack output -C $(pwd)/iac/stacks/src/${stack} --shell > $(pwd)/${OUTPUT_PULUMI_PATH}/${output}.sh`}
													/>
													<CodeCatalystStepX
														run={`cat ${OUTPUT_PULUMI_PATH}/${output}.sh`}
													/>
												</>
											))}

											<CodeCatalystStepX run={`du -sh ${OUTPUT_PULUMI_PATH}`} />
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
							Push_Image: (
								<CodeCatalystBuildX
									architecture={"arm64"}
									caching={FileCaching()}
									timeout={19}
									inputs={{
										Sources: ["WorkflowSource"],
										Variables: [
											...PNPM_ENVIRONMENT,
											register("APPLICATION_IMAGE_NAME", APPLICATION),
											register("AWS_REGION", "us-west-2"),
											register("CI_ENVIRONMENT", "current"),
										],
										Artifacts: ["images", "pulumi"],
									}}
									environment={{
										Name: "current",
									}}
									steps={
										<>
											{...PNPM_NODE_INSTALL_STEPS}
											<CodeCatalystStepX run="pnpm install --prefer-offline --ignore-scripts" />
											<CodeCatalystStepX
												run={`ls -la ${input(OUTPUT_IMAGES_PATH)}`}
											/>
											{...OUTPUT_IMAGES.map(([file]) => (
												<CodeCatalystStepX
													run={`docker load --input ${input(OUTPUT_IMAGES_PATH)}/${file}`}
												/>
											))}
											<CodeCatalystStepX run={"docker images"} />
											<CodeCatalystStepX
												run={`ls -la ${input(OUTPUT_PULUMI_PATH)}`}
											/>
											{...PULUMI_STACKS.flatMap(({ output }) => (
												<>
													<CodeCatalystStepX
														run={`cat ${input(OUTPUT_PULUMI_PATH)}/${output}.sh`}
													/>
													<CodeCatalystStepX
														run={`source ${input(OUTPUT_PULUMI_PATH)}/${output}.sh`}
													/>
												</>
											))}
											<CodeCatalystStepX run={"env"} />
											<CodeCatalystStepX
												run={`NODE_NO_WARNINGS=1 node -e '(${
													// biome-ignore lint/complexity/useArrowFunction:
													function () {
														let outputs = JSON.parse(
															process.env["<STACK_OUTPUT_PATH>"] ?? "",
														);

														let envs = {
															"_<APPLICATION_IMAGE_NAME>_CODE_REPOSITORY_URL":
																outputs.repository.url,
														};

														Object.entries(envs).forEach(([key, value]) => {
															process.stdout.write(
																`export ${key}="${value}"\n`,
															);
														});
													}
														.toString()
														.replaceAll(
															"<APPLICATION_IMAGE_NAME>",
															APPLICATION.toUpperCase(),
														)
														.replaceAll(
															"<STACK_OUTPUT_PATH>",
															PUSH_IMAGE_ECR_STACK_OUTPUT,
														)
												})()' > .ci-env`}
											/>
											<CodeCatalystStepX run={"cat .ci-env"} />
											<CodeCatalystStepX run={"source .ci-env"} />
											<CodeCatalystStepX
												run={
													"export _AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)"
												}
											/>
											<CodeCatalystStepX
												run={`aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $_${APPLICATION.toUpperCase()}_CODE_REPOSITORY_URL`}
											/>
											<CodeCatalystStepX run={`echo $APPLICATION_IMAGE_NAME`} />
											{...[
												`git-${_$_("WorkflowSource.CommitId")}`,
												"$CI_ENVIRONMENT",
											].map((tag) => (
												<>
													<CodeCatalystStepX run={`echo ${tag}`} />
													<CodeCatalystStepX
														run={`echo "Tagging $_${APPLICATION.toUpperCase()}_CODE_REPOSITORY_URL:${tag}"`}
													/>
													<CodeCatalystStepX
														run={`docker tag $APPLICATION_IMAGE_NAME:latest $_${APPLICATION.toUpperCase()}_CODE_REPOSITORY_URL:${tag}`}
													/>
													<CodeCatalystStepX
														run={`docker push $_${APPLICATION.toUpperCase()}_CODE_REPOSITORY_URL:${tag}`}
													/>
												</>
											))}
											<CodeCatalystStepX run={`pnpm store prune`} />
											<CodeCatalystStepX run={`corepack cache clean`} />
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
