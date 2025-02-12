import { CodePipelineArtifactStoreBuilder } from "../../ci/cd/pipeline/codepipeline/CodePipelineArtifactStore.mjs";

export type CodePipelineArtifactStoreXProps = {
	location: string;
	type: "S3";
	encryptionKey?: {
		location: string;
		type: "KMS";
	};
};

export function CodePipelineArtifactStoreX(
	props: CodePipelineArtifactStoreXProps,
) {
	const builder: CodePipelineArtifactStoreBuilder =
		new CodePipelineArtifactStoreBuilder();
	if (props.location) {
		builder.setLocation(props.location);
	}
	if (props.type) {
		builder.setType(props.type);
	}
	if (props.encryptionKey) {
		builder.setEncryptionKey(props.encryptionKey);
	}
	return builder;
}
