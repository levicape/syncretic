/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */
import {
	GithubJobX,
	GithubStepCheckoutX,
	GithubStepNodeInstallX,
	GithubStepNodeSetupX,
	GithubStepX,
	GithubWorkflowExpressions,
	GithubWorkflowX,
} from "@levicape/fourtwo/github";
import { CODECATALYST_PULUMI_STACKS } from "../../PulumiStacks.mts";
import {
	GITHUB_CI_MATRIX,
	type GithubWorkflowProps,
} from "../GithubMatrix.mjs";
const {
	current: { register, context: _$_, env, secret },
} = GithubWorkflowExpressions;

const APPLICATION = "fourtwo";
const PUSH_IMAGE_ECR_STACK_NAME = "codestar";
const PUSH_IMAGE_ECR_STACK_OUTPUT = "codestar_ecr";
const OUTPUT_PULUMI_PATH = "_pulumi";
const RUNS_ON = "act-darwin-a64-atoko";
const FOURTWO_BIN = "pnpm dx:cli:bin";

const DEPLOY_PREAMBLE = [
	"pnpm build:tsc",
	"pnpm -C packages/builders build:tsc",
	"pnpm -C packages/pulumi build:tsc",
];

export const NodeGhaConfiguration = ({
	env: e,
	secret,
	cache,
}: { env: typeof env; secret?: string; cache?: boolean }) =>
	({
		packageManager: {
			node: "pnpm",
			cache: !!(cache === undefined || cache === true),
		},
		registry: {
			scope: "@levicape",
			/**
			 * @see iac/stacks/codestar
			 */
			host: `${e("NPM_REGISTRY_PROTOCOL_LEVICAPE")}://${e("NPM_REGISTRY_HOST_LEVICAPE")}`,
			secret,
		},
		version: {
			node: "22.13.0",
		},
	}) as const;

const cd = (matrix: GithubWorkflowProps<boolean, boolean>) => {
	return (
		<GithubWorkflowX
			name={matrix.name}
			on={matrix.triggers}
			env={{
				...Object.entries(matrix.pipeline.install.npm)
					.map(([name, npm]) => [name.toUpperCase(), npm] as const)
					.reduce(
						(acc, [name, npm]) => ({
							...acc,
							...register(`NPM_REGISTRY_PROTOCOL_${name}`, npm.protocol),
							...register(`NPM_REGISTRY_HOST_${name}`, npm.host),
							...register(
								`NPM_TOKEN_${name}`,
								npm.token(GithubWorkflowExpressions),
							),
						}),
						{},
					),
				...register("NPM_DEFAULT", _$_("vars.NPM_MIRROR")),
				...register("LEVICAPE_REGISTRY_HOST", "npm.pkg.github.com/"),
				...register("LEVICAPE_REGISTRY", "https://npm.pkg.github.com"),
				...register("LEVICAPE_TOKEN", secret("GITHUB_TOKEN")),
				...register("NODE_NO_WARNINGS", "1"),
				...register("NPM_CONFIG_UPDATE_NOTIFIER", "false"),
				...register("FRONTEND_HOSTNAME", `na.levicape.cloud`),
				...register(
					"PULUMI_CONFIG_PASSPHRASE",
					secret("PULUMI_CONFIG_PASSPHRASE"),
				),
				...register("APPLICATION_IMAGE_NAME", APPLICATION),
				...register("APPLICATION_STACKREF_ROOT", _$_("vars.STACK_ROOT")),
				...register(
					"APPLICATION_ENVIRONMENT",
					matrix.pipeline.environment.name,
				),
				...register("AWS_PAGER", ""),
				...register("AWS_REGION", matrix.region),
				...register("AWS_PROFILE", matrix.pipeline.environment.name),
				...register("PULUMI_STACK_FILTER", _$_("vars.STACK_FILTER")),
				...register("DOCKER_NO_IMAGE", _$_("vars.NO_IMAGE")),
			}}
		>
			{
				<GithubJobX
					id={
						matrix.pipeline.deploy
							? "deploy"
							: matrix.pipeline.delete
								? "delete"
								: "preview"
					}
					name={
						matrix.pipeline.deploy
							? "Deploy Pulumi Stacks"
							: matrix.pipeline.delete
								? "Delete Pulumi Stacks"
								: "Preview Pulumi Stacks"
					}
					runsOn={RUNS_ON}
					steps={
						<>
							<GithubStepCheckoutX />
							<GithubStepNodeSetupX
								configuration={NodeGhaConfiguration({ env, cache: true })}
							>
								{(node) => (
									<>
										{/* Verify PULUMI_CONFIG_PASSPHRASE nonempty*/}
										<GithubStepX
											name="Verify PULUMI_CONFIG_PASSPHRASE"
											run={[
												'if [ -z "$PULUMI_CONFIG_PASSPHRASE" ]; then echo "❌❓PULUMI_CONFIG_PASSPHRASE is empty. Stopping workflow.❓"; exit 1; fi',
											]}
										/>
										{/* Verify APPLICATION_STACKREF_ROOT nonempty*/}
										<GithubStepX
											name="Verify APPLICATION_STACKREF_ROOT"
											run={[
												'if [ -z "$APPLICATION_STACKREF_ROOT" ]; then echo "❌❓APPLICATION_STACKREF_ROOT is empty. Stopping workflow.❓"; exit 1; fi',
											]}
										/>
										{/* Verify APPLICATION_ENVIRONMENT nonempty*/}
										<GithubStepX
											name="Verify APPLICATION_ENVIRONMENT"
											run={[
												'if [ -z "$APPLICATION_ENVIRONMENT" ]; then echo "❌❓APPLICATION_ENVIRONMENT is empty. Stopping workflow.❓"; exit 1; fi',
											]}
										/>
										{/* Verdaccio NPM mirror https://verdaccio.org */}
										<GithubStepX
											name="Set NPM Registry to Verdaccio:31313 or NPM_MIRROR"
											run={[
												"pnpm set registry ${NPM_DEFAULT:-http://localhost:31313}",
											]}
										/>
										{/* Install */}
										<GithubStepNodeInstallX {...node} />
										{/* Compile sources */}
										<GithubStepX
											name="Build image"
											run={[
												`if [ -z "\$DOCKER_NO_IMAGE" ]; then 
													pnpm exec nx pack:build iac-images-application --verbose; 
												fi`,
											]}
										/>
										{/* AWS CLI credentials */}
										<GithubStepX
											name="Verify AWS credentials"
											uses="aws-actions/configure-aws-credentials@v4"
											with={{
												"aws-region": "${{ env.AWS_REGION }}",
											}}
										/>
										{/* Pulumi state backend */}
										<GithubStepX
											name="Setup Pulumi state backend"
											run={[
												`echo "🔐🛎️Retriving AWS credentials with ${FOURTWO_BIN} aws in 🗺️$AWS_REGION"`,
												`${FOURTWO_BIN}`,
												`STRUCTURED_LOGGING=quiet ${FOURTWO_BIN} aws pulumi ci --region $AWS_REGION > .pulumi-ci`,
											]}
										/>
										<GithubStepX
											name="Display Pulumi CI output"
											run={["cat .pulumi-ci"]}
										/>
										<GithubStepX
											name="Extract exports from Pulumi CI"
											run={[`cat .pulumi-ci | grep "export" > .export-cd`]}
										/>
										<GithubStepX
											name="Load environment variables"
											run={["cat .export-cd"]}
										/>
										{/* Setup Pulumi helper functions */}
										<GithubStepX
											name="Create Pulumi Helper Functions"
											run={[
												`cat > .pulumi-helper.sh << 'EOF'
configure_stack() {
  local step="$1"
  local stack_name="$2"
  local stack_cwd="$3"
  local project="$4"
  local output="$5"

  echo "✏️🏷️ Overwriting Pulumi.yaml"
  echo "\${step}: Stack: \${stack_name}. CWD: \${stack_cwd}. Output: \${output}."
  echo "name: \${project}" >> "\${stack_cwd}/Pulumi.yaml"
  cat "\${stack_cwd}"/Pulumi.{yaml,"*".yaml} || true
}

setup_stack() {
  local stack_name="$1"
  local stack_cwd="$2"
  
  echo "🪆🧾Setting up stack: \${stack_name}. CWD: \${stack_cwd}."
  for cmd in init select; do
    pulumi stack \${cmd} \${stack_name} -C \${stack_cwd} || true
  done
}

configure_stack_settings() {
  local stack_cwd="$1"
  local configs="$2"
  
  echo "⚙️Configuring stack settings \${stack_cwd}"
  
  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      key="\${line%%=*}"
      value="\${line#*=}"
      
      # Expand variables in value
      eval "value=\"$value\""
      
      if [[ -n "$key" && -n "$value" ]]; then
        echo "📡Setting $key to 💡$value"
        pulumi config set --path "$key" "$value" -C "$stack_cwd"
      fi
    fi
  done <<< "$configs"
}

refresh_and_preview() {
  local message="$1"
  local stack_cwd="$2"
  shift 2
  local default_args="$@"

  check_root || return 0;

  echo "🚦 Refreshing \${stack_cwd} at \${message}"
  echo "💡Default args: \${default_args}"
  pulumi refresh --yes --skip-preview --clear-pending-creates --message "\${message}-refresh" -C "\${stack_cwd}" \${default_args}
  pulumi preview --show-replacement-steps --message "\${message}-preview" -C "\${stack_cwd}" \${default_args} || true
}

deploy_stack() {
  local message="$1"
  local stack_cwd="$2"
  shift 2
  local default_args="$@"

  check_root || return 0;

  echo "🛫 Deploying \${stack_cwd} at \${message}"
  echo "💡Default args: \${default_args}"
  pulumi up --yes --message "\${message}-up" -C "\${stack_cwd}" \${default_args}
}

remove_stack() {
  local message="$1"
  local stack_cwd="$2"
  shift 2
  local default_args="$@"

  check_root || return 0;

  echo "🦺 Deleting \${stack_cwd} at \${message}"
  echo "💡Default args: \${default_args}"
  pulumi down --yes --message "\${message}-down" -C "\${stack_cwd}" \${default_args}
}

capture_outputs() {
  local stack_cwd="$1"
  local output="$2"

  echo "🧲Capturing \${stack_cwd} outputs in \${output}.sh"
  pulumi stack output -C "\${stack_cwd}" --json > "$(pwd)/\${output}.json"
  cat "\${output}.json"
  pulumi stack output -C "\${stack_cwd}" --shell > "$(pwd)/\${output}.sh"
  cat "\${output}.sh"
  ls ${OUTPUT_PULUMI_PATH}
  chmod +x "$(pwd)/\${output}.sh"
  echo "🎼Outputs captured in \${output}.sh"
}

set_root() {
  local only_root="$1"
  echo "✴️"
  echo "Configuring STACKREF_ROOT:"
  echo "APPLICATION_IMAGE_NAME: \${APPLICATION_IMAGE_NAME}"
  echo "APPLICATION_STACKREF_ROOT: \${APPLICATION_STACKREF_ROOT}"
  echo "Current stack only deployed to application root: \${only_root}"

  export STACKREF_ROOT="\${APPLICATION_STACKREF_ROOT:-$APPLICATION_IMAGE_NAME}"

  echo "🤍🤍"
  echo "Pulumi resolved stackref root: "
  echo "STACKREF_ROOT: \${STACKREF_ROOT}"
  echo "🤍🤍"

	if [[ "\${only_root}" == "true" ]]; then
		if [[ "\${APPLICATION_IMAGE_NAME}" == "\${STACKREF_ROOT}" ]]; then
    		echo "🆗🚀Stackref is compatible, setting PULUMI_NO_DEPLOYMENT=false"
    		export PULUMI_NO_DEPLOYMENT=false
		else
			echo "🆗💤Not in application root stack, skipping deployment with PULUMI_NO_DEPLOYMENT=true"
			export PULUMI_NO_DEPLOYMENT=true									
		fi
	else
		echo "🚀🚀Stack not application-only, setting PULUMI_NO_DEPLOYMENT=false"
		export PULUMI_NO_DEPLOYMENT=false
	fi
  echo "✴️"
}

check_root() {
  if [ "\${PULUMI_NO_DEPLOYMENT}" = "true" ]; then
    echo "💤💤Skipping deployment"
    return 1
  else
    echo "🔰🔰Proceeding with deployment"
    return 0
  fi
}
EOF
chmod +x .pulumi-helper.sh
source .pulumi-helper.sh`,
											]}
										/>

										{/* Process Pulumi Stacks */}
										<GithubStepX
											name={`Deploy ${APPLICATION} stacks`}
											run={[
												`mkdir -p ${OUTPUT_PULUMI_PATH}`,
												"source .export-cd",
												...DEPLOY_PREAMBLE,
												"source .pulumi-helper.sh",
												...((s) =>
													matrix.pipeline.delete !== true ? s : s.reverse())(
													CODECATALYST_PULUMI_STACKS,
												).flatMap(({ stack, name, output, root }) => {
													const STEP = matrix.pipeline.deploy
														? "Deploy"
														: matrix.pipeline.delete
															? "Delete"
															: "Preview";
													const PULUMI_DEFAULT_ARGS =
														"--non-interactive --suppress-progress --diff --json";
													const PULUMI_STACK_CWD = `$(pwd)/iac/stacks/src/${stack}`;
													const PULUMI_APPLICATION_ROOT = `\${APPLICATION_STACKREF_ROOT:-$APPLICATION_IMAGE_NAME}`;
													const PULUMI_PROJECT = `${PULUMI_APPLICATION_ROOT}-${name ?? stack}`;
													const PULUMI_STACK_NAME = `${PULUMI_PROJECT}.${matrix.pipeline.environment.name}`;
													const PULUMI_STACK_OUTPUT = `${OUTPUT_PULUMI_PATH}/${output}`;
													const PULUMI_MESSAGE =
														"${{ github.ref_name }}-${{ github.sha }}";
													const PULUMI_CONFIGS = Object.entries({
														"aws:skipMetadataApiCheck": false,
														"context:stack.environment.isProd": false,
														"context:stack.environment.features": "aws",
														"frontend:stack.dns.hostnames[0]": `${PULUMI_APPLICATION_ROOT}.${matrix.pipeline.environment.name}.$FRONTEND_HOSTNAME`,
													})
														.map(([k, v]) => `${k}=${v}`)
														.join("\n");

													// STACK_FILTER:
													// -> * will deploy every stack
													// -> (head, next...): comma delimited list of stacks to deploy
													const STACK_FILTER = `
													if [ -n "\$PULUMI_STACK_FILTER" ]; then
														if [ "\$PULUMI_STACK_FILTER" = "*" ]; then
															echo "👞🌠Running all stacks due to wildcard filter"
															true
														elif [ "\$PULUMI_STACK_FILTER" = "${PULUMI_PROJECT}" ]; then
															echo "👞🧤Stack ${PULUMI_PROJECT} matched in filter"
															true
														elif echo ",\$PULUMI_STACK_FILTER," | grep -q ",${PULUMI_PROJECT},"; then
															echo "👞🧤Stack ${PULUMI_PROJECT} found in comma-separated list"
															true
														else
															echo "👞🙅Stack ${PULUMI_PROJECT} not in filter '\$PULUMI_STACK_FILTER', skipping"
															false
														fi
													else
														echo "👟🧤No stack filter specified, processing all stacks"
														true
													fi &&`;

													// DIFF_FILTER:
													// Only applied if STACK_FILTER is empty or not set
													// Will "git diff" the location at PULUMI_STACK_CWD, and only issue commands if there are any changes
													// const DIFF_FILTER = `if [ -z "\$PULUMI_STACK_FILTER" ]; then
													// 		if git diff --quiet HEAD HEAD~1 -- "${PULUMI_STACK_CWD}"; then
													// 			echo "No changes detected in ${PULUMI_PROJECT}, skipping."
													// 			false
													// 		else
													// 			echo "Changes detected in ${PULUMI_PROJECT}, proceeding..."
													// 		fi
													// 	fi &&`;

													return [
														`echo ".📁"`,
														`echo "...📁"`,
														`echo "Processing 💾${PULUMI_STACK_NAME}"`,
														`echo "⚗️PULUMI_STACK_FILTER: \$PULUMI_STACK_FILTER"`,
														`echo "💡PULUMI_STACK_CWD: ${PULUMI_STACK_CWD}"`,
														`echo "🐤PULUMI_STACK_NAME: ${PULUMI_STACK_NAME}"`,
														...[
															`set_root "${root ? "true" : "false"}"`,
															`configure_stack "${STEP}" "${PULUMI_STACK_NAME}" "${PULUMI_STACK_CWD}" "${PULUMI_PROJECT}" "${PULUMI_STACK_OUTPUT}"`,
															`setup_stack "${PULUMI_STACK_NAME}" "${PULUMI_STACK_CWD}"`,
															`configure_stack_settings "${PULUMI_STACK_CWD}" '${PULUMI_CONFIGS}'`,
															matrix.pipeline.delete
																? `remove_stack "${PULUMI_MESSAGE}" "${PULUMI_STACK_CWD}" ${PULUMI_DEFAULT_ARGS}`
																: `refresh_and_preview "${PULUMI_MESSAGE}" "${PULUMI_STACK_CWD}" ${PULUMI_DEFAULT_ARGS}`,
															...(matrix.pipeline.deploy
																? [
																		`deploy_stack "${PULUMI_MESSAGE}" "${PULUMI_STACK_CWD}" ${PULUMI_DEFAULT_ARGS}`,
																		`capture_outputs "${PULUMI_STACK_CWD}" "${PULUMI_STACK_OUTPUT}"`,
																	]
																: []),
														]
															.map((bash) => {
																const FILTERBASH = `${STACK_FILTER}`;
																return `${FILTERBASH} ${bash}`;
															})
															.concat([
																`echo "Stack 💾${PULUMI_STACK_NAME} processed"`,
																`echo "...📂"`,
																`echo ".📂"`,
															]),
													];
												}),
											]}
										/>
										{/* Tag and push images */}
										{matrix.pipeline.push === true &&
											[
												"git-${{ github.sha }}",
												"${{ env.APPLICATION_IMAGE_NAME }}-${{ env.APPLICATION_ENVIRONMENT }}",
											].map((tag) => (
												<>
													{/* Push to ECR */}
													<GithubStepX
														name={`Tag and push image with ${tag}`}
														run={[
															`
															if [[ -z "\$PULUMI_STACK_FILTER" || "\$PULUMI_STACK_FILTER" == "*" || "\$PULUMI_STACK_FILTER" =~ "${PUSH_IMAGE_ECR_STACK_NAME}" ]]; then
																echo "📟Codestar output found, deploying image"
																true
															else
																echo "💢Please verify PULUMI_STACK_FILTER: \$PULUMI_STACK_FILTER \n This should include ${PUSH_IMAGE_ECR_STACK_NAME} for the image push mechanism"
																exit 0
															fi`,
															...[
																`ls -la ${OUTPUT_PULUMI_PATH} || true`,
																...CODECATALYST_PULUMI_STACKS.flatMap(
																	({ output }) => [
																		`[ -f ${OUTPUT_PULUMI_PATH}/${output}.sh ] && cat ${OUTPUT_PULUMI_PATH}/${output}.sh`,
																		`[ -f ${OUTPUT_PULUMI_PATH}/${output}.sh ] && source ${OUTPUT_PULUMI_PATH}/${output}.sh`,
																	],
																),
																`echo "🥤Verify imported environment variables"`,
																`set +o histexpand`,
																`export STACKREF_ROOT="\${APPLICATION_STACKREF_ROOT:-$APPLICATION_IMAGE_NAME}"`,
																`export TARGET_VAR="\${STACKREF_ROOT}_${PUSH_IMAGE_ECR_STACK_OUTPUT}"`,
																`export TARGET_VALUE="\${!TARGET_VAR}"`,
																`echo "❔❔Codestar output \${TARGET_VAR}: \${TARGET_VALUE}"`,
																`export ECR_URL=$(echo  \${TARGET_VALUE} | jq -r .repository.url)`,
																`echo "❔❔ECR_URL: $ECR_URL"`,
																`aws sts get-caller-identity --output json`,
																"sleep 2s",
																`aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL`,
															],
															`echo "🌐Tagging $ECR_URL:${tag}"`,
															`docker tag ${env("APPLICATION_IMAGE_NAME")}:latest $ECR_URL:${tag}`,
															`docker push $ECR_URL:${tag}`,
															`echo "✨Tagged $ECR_URL:${tag}"`,
														]}
													/>
												</>
											))}
										{/* Cleanup */}
										<GithubStepX
											name="Cleanup"
											run={[
												`rm -f ${[
													".pulumi-ci",
													".export-cd",
													".pulumi-helper.sh",
													".ci-env",
												].join(" ")}`,
												`rm -rf ${OUTPUT_PULUMI_PATH}`,
											]}
										/>
									</>
								)}
							</GithubStepNodeSetupX>
						</>
					}
				/>
			}
		</GithubWorkflowX>
	);
};

export default async () => GITHUB_CI_MATRIX.map(cd);
