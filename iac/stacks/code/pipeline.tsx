/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import type { CodePipelineDefinitionBuilder } from "@levicape/fourtwo/ci/cd/pipeline/codepipeline";
import {
	CodePipelineActionX,
	CodePipelineArtifactStoreX,
	CodePipelineDefinitionX,
	CodePipelineStageX,
} from "@levicape/fourtwo/x/codepipeline";

export const OnPushPipeline = ({
	roleArn,
	artifactBucket,
}: {
	roleArn: string;
	artifactBucket: string;
}): CodePipelineDefinitionBuilder => (
	<CodePipelineDefinitionX
		name={"OnPushPipeline"}
		executionMode={"PARALLEL"}
		roleArn={roleArn}
		artifactStore={
			<CodePipelineArtifactStoreX type={"S3"} location={artifactBucket} />
		}
		stages={
			<>
				<CodePipelineStageX
					name={"Source"}
					actions={
						<CodePipelineActionX
							name={"Source"}
							actionTypeId={{
								category: "Source",
								provider: "S3",
								owner: "AWS",
								version: "1",
							}}
							configuration={{
								S3Bucket: "my-bucket-source",
								S3ObjectKey: "source.zip",
								PollForSourceChanges: "false",
							}}
							inputArtifacts={[]}
							outputArtifacts={[{ name: "Sources" }]}
						/>
					}
				/>
			</>
		}
	/>
);

console.dir(
	OnPushPipeline({
		roleArn:
			"arn:aws:iam::123456789012:role/service-role/CodePipelineServiceRole",
		artifactBucket: "my-bucket",
	}).build(),
	{ depth: null },
);
