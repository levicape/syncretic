import { z } from "zod";

const ecs = z.object({
	AWS_EXECUTION_ENV: z.string().optional(),
	AWS_CA_BUNDLE: z.string().optional(),
	AWS_CONTAINER_TOKEN_ENDPOINT: z.string().optional(),
	AWS_CONTAINER_CREDENTIALS_FULL_URI: z.string().optional(),
	ECS_AGENT_URI: z.string().optional(),
	ECS_CONTAINER_METADATA_URI: z.string().optional(),
});

export type AwsEcsEnvironment = z.infer<typeof ecs>;

const catalyst = z.object({
	CATALYST_EVENT_SHA: z.string().optional(),
	CATALYST_ENTRY_POINT_SCRIPT_DIR: z.string().optional(),
	CATALYST_WORKFLOW_SPACE_NAME: z.string().optional(),
	CATALYST_WORKFLOW_PROJECT_ID: z.string().optional(),
	CATALYST_WORKFLOW_RUN_NUMBER: z.string().optional(),
	CATALYST_WORKFLOW_YAML_SHA: z.string().optional(),
	CATALYST_SOURCE_BEFORE_COMMIT_ID: z.string().optional(),
	CATALYST_SOURCE_REPO_NAME: z.string().optional(),
	CATALYST_SOURCE_REPO_ID: z.string().optional(),
});

export type AwsCatalystEnvironment = z.infer<typeof catalyst>;

export const AwsEnvironment = z.intersection(ecs, catalyst);
