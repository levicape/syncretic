/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { Repository as ECRRepository } from "@pulumi/aws/ecr";

// Configures account with ECR, S3, and CodePipeline
export = async () => {
	// ECR
	const ecr = (() => {
		const repository = new ECRRepository("ecrRepository", {
			name: "artifact",
		});

		return {
			repository,
		};
	})();

	const pipelines = ["infrastructure", "application", "website"].map(() => {
		// CodePipeline
		// const codePipeline = new Pipeline("codePipeline", {
		// 	name: "artifact"
		// });
	});

	return {
		ecr,
	};
};
