/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { Repository as CodeArtifactRepository } from "@pulumi/aws/codeartifact";
import { Pipeline } from "@pulumi/aws/codepipeline";
import { Repository as ECRRepository } from "@pulumi/aws/ecr";
import { Bucket } from "@pulumi/aws/s3";

// Configures account with CodeArtifact, ECR, S3, and CodePipeline
export = async () => {
	// CodeArtifact
	const codeArtifactRepository = new CodeArtifactRepository(
		"codeArtifactRepository",
		{
			domain: "levicape",
			repository: "artifact",
		},
	);

	// ECR
	const ecrRepository = new ECRRepository("ecrRepository", {
		name: "artifact",
	});

	// S3
	const s3Bucket = new Bucket("s3Bucket", {
		bucket: "artifact",
	});

	const pipelines = ["infrastructure", "application", "website"].map(() => {
		// CodePipeline
		// const codePipeline = new Pipeline("codePipeline", {
		// 	name: "artifact"
		// });
	});
	return {};
};
