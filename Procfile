aws-pulumi-ci: pnpm run dx:cli:mjs aws pulumi ci
cli: pnpm run dx:cli:mjs
deploy: pnpm --filter $DEPLOY_FILTER --prod --node-linker=hoisted deploy $DEPLOY_OUTPUT && sleep 1200s
deploy-panel-io: pnpm --filter @levicape/fourtwo-panel-io --prod --node-linker=hoisted deploy /tmp/fourtwo-panel-io && sleep 1200s
deploy-panel-ui: pnpm --filter @levicape/fourtwo-panel-ui --prod --node-linker=hoisted deploy /tmp/fourtwo-panel-ui && sleep 1200s
test: pnpm run test