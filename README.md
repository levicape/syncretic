# @atoko/pulumi

## State Backend Instructions
```
pulumi stack init dev;
pulumi config set aws:region us-east-1;
pulumi config set --path context:stack.bootstrap.enabled true;
```

### Create state buckets
```
pulumi up
```
### Specify the outputs from the previous command
```
export PULUMI_BACKEND_URL="<PULUMI_BACKEND_URL>"
export PULUMI_SECRETS_PROVIDER="<PULUMI_SECRETS_PROVIDER>"
export AWS_REGION=us-east-1; 
export AWS_PROFILE=latest;
pulumi login s3://aws-state-bucket-a3b7419;
pulumi stack init --secrets-provider="awskms:///2032e" <project-name>.<stack-name>;

PULUMI_CONFIG_PASSPHRASE= npm run publish
