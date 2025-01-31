bootstrap: [[ -z $BOOTSTRAP_ARCH ]] && echo "Bootstrap: $BOOTSTRAP_ARCH ; this: $_" || echo 'BOOTSTRAP_ARCH not set'; mkdir -p /tmp || true; cp ./iac/bootstrap/$BOOTSTRAP_ARCH/bootstrap /tmp/bootstrap || true; chmod +x /tmp/bootstrap || true; ls -la /tmp || true; echo "bootstrap $BOOTSTRAP_ARCH complete"; sleep 1200s;
cli: pnpm run dx:cli:mjs
deploy: pnpm --filter $DEPLOY_FILTER --prod --node-linker=hoisted deploy $DEPLOY_OUTPUT || true; ls -la $DEPLOY_OUTPUT || true; echo "rebuilding $DEPLOY_FILTER" && pnpm -c $DEPLOY_OUTPUT rebuild || true; echo "procfile deploy to $DEPLOY_OUTPUT complete"; sleep 1200s;
project: [[ -z $PROJECT_PATH ]] && echo "Project: $PROJECT_PATH ; this: $_" || echo 'PROJECT_PATH not set'; pnpm -C $PROJECT_PATH run $PROJECT_COMMAND
test: pnpm run test