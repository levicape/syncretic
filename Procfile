bootstrap: [[ -z $BOOTSTRAP_ARCH ]] && echo "Bootstrap: $BOOTSTRAP_ARCH ; this: $_" || echo 'BOOTSTRAP_ARCH not set'; mkdir -p /tmp || true; cp ./iac/bootstrap/$BOOTSTRAP_ARCH/bootstrap /tmp/bootstrap || true; chmod +x /tmp/bootstrap || true; ls -la /tmp || true; echo "bootstrap $BOOTSTRAP_ARCH complete"; sleep 1200s;
cli: pnpm run dx:cli:mjs
store: pnpm store status
deploy: pnpm --filter $DEPLOY_FILTER --prod $DEPLOY_ARGS deploy $DEPLOY_OUTPUT || true; ls -la $DEPLOY_OUTPUT || true; echo "the $DEPLOY_OUTPUT procfile deploy completed"; sleep 1200s;
# DEPLOY_ARGS= --verify-store-integrity=false --node-linker=hoisted --prefer-offline
project: [[ -z $PROJECT_PATH ]] && echo "Project: $PROJECT_PATH ; this: $_" || echo 'PROJECT_PATH not set'; pnpm -C $PROJECT_PATH run $PROJECT_COMMAND