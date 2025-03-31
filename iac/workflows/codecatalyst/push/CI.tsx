/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { AwsStateBackendCommandsParameter } from "@levicape/fourtwo/cli/commands/aws/pulumi/AwsPulumiBackendCommand";
import {
	CodeCatalystActionGroupX,
	CodeCatalystBuildX,
	CodeCatalystStepX,
	CodeCatalystWorkflowExpressions,
	CodeCatalystWorkflowX,
} from "@levicape/fourtwo/codecatalyst";
import { CODECATALYST_PULUMI_STACKS } from "../../PulumiStacks.mts";
import {
	CODECATALYST_CI_MATRIX,
	type CodeCatalystWorkflowProps,
} from "../CodeCatalystMatrix.mjs";

const APPLICATION = "fourtwo";
const PUSH_IMAGE_ECR_STACK_OUTPUT = "fourtwo_codestar_ecr";

const FileCaching = ({
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

const PULUMI_CACHE = FileCaching({ pulumi: true }).FileCaching.a64_pulumi
	?.Path as string;

const COREPACK_GLOBAL_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/corepack`;
const NPM_GLOBAL_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/npm`;
const PNPM_DLX_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/pnpmcache`;
const PNPM_STORE_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/addressable`;
const PNPM_GLOBAL_CACHE = `${FileCaching().FileCaching.a64_nodejs.Path}/pnpmglobal`;
const NX_CACHE_DIR = `${FileCaching().FileCaching.a64_nodejs.Path}/nxcache`;

const NODEJS_CACHES = [
	COREPACK_GLOBAL_CACHE,
	NPM_GLOBAL_CACHE,
	PNPM_DLX_CACHE,
	PNPM_STORE_CACHE,
	PNPM_GLOBAL_CACHE,
	NX_CACHE_DIR,
];

const DOCKER_CACHE = FileCaching({ docker: true }).FileCaching.a64_docker
	?.Path as string;

const PYENV_ROOT = FileCaching({ python: true }).FileCaching.a64_python?.Path;

const ALL_CACHES = Object.values(
	FileCaching({ docker: true, pulumi: true }),
).flatMap((cache) => Object.values(cache).map((cache) => cache.Path));

const DOCKER_IMAGES = [
	["cli-pack.tar.gz", "$PAKETO_CLI_IMAGE"],
	["builder.tar.gz", "$PAKETO_BUILDER_IMAGE"],
	["launcher.tar.gz", "$PAKETO_LAUNCHER_IMAGE"],
] as const;

const OUTPUT_IMAGES_PATH = "_images" as const;
const OUTPUT_PULUMI_PATH = "_pulumi" as const;

const OUTPUT_IMAGES = [
	["application.tar.gz", "$APPLICATION_IMAGE_NAME"],
] as const;

const input = (name: `_${string}`) => `$CATALYST_SOURCE_DIR${name}/${name}`;

const cicd = <Preview extends boolean, Deploy extends boolean>(
	matrix: CodeCatalystWorkflowProps<Preview, Deploy>,
) => {
	let {
		current: { register, context: _$_, env, secret },
	} = CodeCatalystWorkflowExpressions;

	const PNPM_ENVIRONMENT = [
		register("COREPACK_HOME", COREPACK_GLOBAL_CACHE),
		register("PNPM_VERSION", "pnpm@9.15.4"),
		register("NODEJS_VERSION", "22.12.0"),
		register("NX_CACHE_DIRECTORY", NX_CACHE_DIR),
		...Object.entries(matrix.pipeline.install.npm).flatMap(([name, npm]) => [
			register(`NPM_REGISTRY_PROTOCOL_${name}`, npm.protocol),
			register(`NPM_REGISTRY_HOST_${name}`, npm.host),
			register(
				`NODE_AUTH_TOKEN_${name}`,
				npm.token(CodeCatalystWorkflowExpressions),
			),
		]),
	];

	const PULUMI_ENVIRONMENT = [
		register("AWS_REGION", matrix.region),
		register("FRONTEND_HOSTNAME", `${APPLICATION}.levicape.cloud`),
		register("PULUMI_CONFIG_PASSPHRASE", secret("PULUMI_CONFIG_PASSPHRASE")),
		register("PULUMI_HOME", PULUMI_CACHE),
		register("PULUMI_VERSION", "3.152.0"),
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
			{Object.entries(matrix.pipeline.install.npm).flatMap(
				([name, { scope }]) => [
					<CodeCatalystStepX
						run={[
							`npm config set ${scope}:registry=${env(`NPM_REGISTRY_PROTOCOL_${name}`)}://${env(`NPM_REGISTRY_HOST_${name}`)} --location project`,
							`npm config set //${env(`NPM_REGISTRY_HOST_${name}`)}/:_authToken=${env(`NODE_AUTH_TOKEN_${name}`)} --location project`,
						].join("; ")}
					/>,
				],
			)}
			{...(
				<>
					<CodeCatalystStepX
						run={["sudo ", ""]
							.flatMap((su) => [
								`${su}npm config set prefix=${NPM_GLOBAL_CACHE}`,
								`${su}corepack -g install $PNPM_VERSION`,
								`${su}corepack enable pnpm`,
								`${su}pnpm config set cache-dir ${PNPM_DLX_CACHE}`,
								`${su}pnpm config set global-dir ${PNPM_GLOBAL_CACHE}`,
								`${su}pnpm config set store-dir ${PNPM_STORE_CACHE}`,
								`${su}pnpx n $NODEJS_VERSION`,
							])
							.map(
								(c) =>
									`echo '' && echo '>>>>>>>>>>>>>' && echo '${c}' && echo '' && ${c}`,
							)
							.join(";")}
					/>
					<CodeCatalystStepX
						run={["sudo ", ""]
							.flatMap((su) => [
								`${su}npm config set prefix=${NPM_GLOBAL_CACHE}`,
								`${su}corepack -g install $PNPM_VERSION`,
								`${su}corepack enable pnpm`,
								`${su}pnpm config set cache-dir ${PNPM_DLX_CACHE}`,
								`${su}pnpm config set global-dir ${PNPM_GLOBAL_CACHE}`,
								`${su}pnpm config set store-dir ${PNPM_STORE_CACHE}`,
								`${su}pnpx n $NODEJS_VERSION`,
							])
							.map(
								(c) =>
									`echo '' && echo '>>>>>>>>>>>>>' && echo '${c}' && echo '' && ${c}`,
							)
							.join(";")}
					/>
					<CodeCatalystStepX
						run={["sudo ", ""]
							.flatMap((su) => [
								`${su}npm config set prefix=${NPM_GLOBAL_CACHE}`,
								`${su}corepack -g install $PNPM_VERSION`,
								`${su}corepack enable pnpm`,
								`${su}pnpm config set cache-dir ${PNPM_DLX_CACHE}`,
								`${su}pnpm config set global-dir ${PNPM_GLOBAL_CACHE}`,
								`${su}pnpm config set store-dir ${PNPM_STORE_CACHE}`,
								`${su}pnpx n $NODEJS_VERSION`,
							])
							.map(
								(c) =>
									`echo '' && echo '>>>>>>>>>>>>>' && echo '${c}' && echo '' && ${c}`,
							)
							.join("; ")}
					/>
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
			name={matrix.name}
			runMode={"SUPERSEDED"}
			compute={
				matrix.compute ?? {
					Type: "EC2",
					Fleet: "Linux.Arm64.XLarge",
				}
			}
			triggers={matrix.triggers}
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
											<CodeCatalystStepX run="ls /tmp/mce/tmp || true" />
											<CodeCatalystStepX run="cat /tmp/mce/tmp/script.sh || true" />
											<CodeCatalystStepX run="cat /tmp/mce/tmp/* || true" />
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
							...(matrix.pipeline.image === true
								? {
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
														{
															Name: "images",
															Files: [`${OUTPUT_IMAGES_PATH}/**/*`],
														},
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
														<CodeCatalystStepX
															run={`ls -la ${OUTPUT_IMAGES_PATH}`}
														/>
													</>
												}
											/>
										),
									}
								: {}),
							...(matrix.pipeline.preview === true
								? {
										[matrix.pipeline.deploy ? "Deploy" : "Preview"]: (
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
														register(
															"APPLICATION_ENVIRONMENT",
															matrix.pipeline.environment.name,
														),
													],
													Artifacts: ["images"],
												}}
												outputs={{
													Artifacts: [
														{
															Name: "pulumi",
															Files: [`${OUTPUT_PULUMI_PATH}/**/*`],
														},
													],
												}}
												environment={{
													Name: matrix.pipeline.environment.name,
												}}
												steps={(() => {
													const STEP = matrix.pipeline.deploy
														? "Deploy"
														: "Preview";
													const PULUMI_SECRETS_PROVIDER = `$AWS_PROVIDER_KEY`;
													return (
														<>
															{...PNPM_NODE_INSTALL_STEPS}
															<CodeCatalystStepX run="pnpm install --prefer-offline --ignore-scripts" />
															{/* Bootstrap fourtwo cli */}
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
															{/* Configure $AWS_PROVIDER_KEY */}
															<CodeCatalystStepX
																run={`aws ssm get-parameter --name ${AwsStateBackendCommandsParameter()}`}
															/>
															{/* Run CLI in docker container */}
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
															<CodeCatalystStepX
																run={`echo ${PULUMI_SECRETS_PROVIDER}`}
															/>
															{/* Define Bash helper functions */}
															<CodeCatalystStepX
																run={[
																	"echo '",
																	`configure_stack() {
	local step="$1"
	local stack_name="$2"
	local stack_cwd="$3"
	local project="$4"
	local output="$5"

	echo "\${step}: Stack: \${stack_name}. CWD: \${stack_cwd}. Output: \${output}."
	echo "name: \${project}" >> "\${stack_cwd}/Pulumi.yaml"
	cat "\${stack_cwd}"/Pulumi.{yaml,"*".yaml} || true
}`,
																	`setup_stack() {
	local binary="$1"
	local stack_name="$2"
	local stack_cwd="$3"
	
	echo "Setting up stack: \${stack_name}. CWD: \${stack_cwd}."
	for cmd in init select; do
		\${binary} stack \${cmd} \${stack_name} -C \${stack_cwd} || true
	done
}`,
																	`configure_stack_settings() {
	local binary="$1"
	local stack_cwd="$2"
	local configs="$3"
	
	echo "Configuring stack settings"
	
	while IFS= read -r line; do
	  if [[ -n "$line" ]]; then
		key="\${line%%=*}"
		value="\${line#*=}"
      	
		# Expand variables in value
		eval "value=\"$value\""
		
		if [[ -n "$key" && -n "$value" ]]; then
		  echo "Setting $key to $value"
		  $binary config set --path "$key" "$value" -C "$stack_cwd"
		fi
	  fi
	done <<< "$configs"
  }`,
																	`set_state_backend() {
	local binary="$1"
	local provider="$2"
	local stack_cwd="$3"

	\${binary} stack change-secrets-provider "\${provider}" -C "\${stack_cwd}"
	cat "\${stack_cwd}"/Pulumi.{yaml,"*".yaml} || true
}`,
																	`refresh_and_preview() {
	local binary="$1"
	local message="$2"
	local stack_cwd="$3"
	shift 3
	local -a default_args=("$@")

	\${binary} refresh --yes --skip-preview --clear-pending-creates --message "\${message}-refresh" -C "\${stack_cwd}" "\${default_args[@]}"
	\${binary} preview --show-replacement-steps --message "\${message}-preview" -C "\${stack_cwd}" "\${default_args[@]}"
}`,
																	`deploy_stack() {
	local binary="$1"
	local message="$2"
	local stack_cwd="$3"
	shift 3
	local -a default_args=("$@")

	\${binary} up --yes --message "\${message}-up" -C "\${stack_cwd}" "\${default_args[@]}"

}
`,
																	`capture_outputs() {
	local binary="$1"
	local stack_cwd="$2"
	local output="$3"

	\${binary} stack output -C "\${stack_cwd}" --json > "$(pwd)/\${output}.json"
	cat "\${output}.json"
	\${binary} stack output -C "$\{stack_cwd}" --shell > "$(pwd)/\${output}.sh"
	cat "\${output}.sh"
}`,
																	`' > .pulumi-ci-helper;`,
																	`source .pulumi-ci-helper`,
																].join("\n")}
															/>
															{/* Map over Pulumi stack configuration */}
															<CodeCatalystStepX
																run={`mkdir -p ${OUTPUT_PULUMI_PATH} || true`}
															/>
															<CodeCatalystStepX
																run={`echo "${STEP} onto root: ${APPLICATION}"`}
															/>
															{...CODECATALYST_PULUMI_STACKS.flatMap(
																({ stack, name, output, root }) => {
																	const PULUMI_BINARY = `${PULUMI_CACHE}/bin/pulumi`;
																	const PULUMI_DEFAULT_ARGS = [
																		`--non-interactive`,
																		`--suppress-progress`,
																		`--diff`,
																		"--json",
																	].join(" ");
																	const PULUMI_STACK_CWD = `$(pwd)/iac/stacks/src/${stack}`;
																	const PULUMI_PROJECT = `${root ?? APPLICATION}-${name ?? stack}`;
																	const PULUMI_STACK_NAME = `${PULUMI_PROJECT}.${matrix.pipeline.environment.name}`;
																	const PULUMI_STACK_OUTPUT = `${OUTPUT_PULUMI_PATH}/${output}`;
																	const PULUMI_MESSAGE = `${_$_("WorkflowSource.BranchName")}-${_$_("WorkflowSource.CommitId")}`;
																	const PULUMI_CONFIGS = Object.entries({
																		"aws:skipMetadataApiCheck": false,
																		"context:stack.environment.isProd": false,
																		"context:stack.environment.features": "aws",
																		"frontend:stack.dns.hostnames[0]": `${matrix.pipeline.environment.name}.${root ?? APPLICATION}.$FRONTEND_HOSTNAME`,
																		"frontend:stack.dns.hostnames[1]": `${PULUMI_PROJECT}.${matrix.pipeline.environment.name}.${root ?? APPLICATION}.$FRONTEND_HOSTNAME`,
																	})
																		.map(([k, v]) => `${k}=${v}`)
																		.join("\n");

																	return (
																		<>
																			<CodeCatalystStepX
																				run={[
																					`source .pulumi-ci-helper`,
																					`configure_stack "${STEP}" "${PULUMI_STACK_NAME}" "${PULUMI_STACK_CWD}" "${PULUMI_PROJECT}" "${PULUMI_STACK_OUTPUT}"`,
																					`setup_stack "${PULUMI_BINARY}" "${PULUMI_STACK_NAME}" "${PULUMI_STACK_CWD}"`,
																					`configure_stack_settings "${PULUMI_BINARY}" "${PULUMI_STACK_CWD}" '${PULUMI_CONFIGS}'`,
																					`set_state_backend "${PULUMI_BINARY}" "${PULUMI_SECRETS_PROVIDER}" "${PULUMI_STACK_CWD}"`,
																					`refresh_and_preview "${PULUMI_BINARY}" "${PULUMI_MESSAGE}" "${PULUMI_STACK_CWD}" ${PULUMI_DEFAULT_ARGS}`,
																				].join(" && ")}
																			/>
																			{matrix.pipeline.deploy === true && (
																				<CodeCatalystStepX
																					run={[
																						`source .pulumi-ci-helper`,
																						`deploy_stack "${PULUMI_BINARY}" "${PULUMI_MESSAGE}" "${PULUMI_STACK_CWD}" ${PULUMI_DEFAULT_ARGS}`,
																						`capture_outputs "${PULUMI_BINARY}" "${PULUMI_STACK_CWD}" "${PULUMI_STACK_OUTPUT}"`,
																					].join("\n")}
																				/>
																			)}
																		</>
																	);
																},
															)}
															<CodeCatalystStepX
																run={`du -sh ${OUTPUT_PULUMI_PATH}`}
															/>
														</>
													);
												})()}
											/>
										),
									}
								: {}),
						}}
					</CodeCatalystActionGroupX>
				),
				...(matrix.pipeline.push === true
					? {
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
														register("AWS_REGION", matrix.region),
														register(
															"APPLICATION_ENVIRONMENT",
															matrix.pipeline.environment.name,
														),
													],
													Artifacts: ["images", "pulumi"],
												}}
												environment={{
													Name: matrix.pipeline.environment.name,
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
														{...CODECATALYST_PULUMI_STACKS.flatMap(
															({ output }) => (
																<>
																	<CodeCatalystStepX
																		run={`cat ${input(OUTPUT_PULUMI_PATH)}/${output}.sh`}
																	/>
																	<CodeCatalystStepX
																		run={`source ${input(OUTPUT_PULUMI_PATH)}/${output}.sh`}
																	/>
																</>
															),
														)}
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

																	Object.entries(envs).forEach(
																		([key, value]) => {
																			process.stdout.write(
																				`export ${key}="${value}"\n`,
																			);
																		},
																	);
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
														<CodeCatalystStepX
															run={`echo $APPLICATION_IMAGE_NAME`}
														/>
														{...[
															`git-${_$_("WorkflowSource.CommitId")}`,
															"$APPLICATION_ENVIRONMENT",
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
						}
					: {}),
			}}
		</CodeCatalystWorkflowX>
	);
};

export default async () => CODECATALYST_CI_MATRIX.map(cicd);
