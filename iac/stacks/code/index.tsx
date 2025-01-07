/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { Context } from "@levicape/fourtwo-pulumi";
import { Repository as ECRRepository } from "@pulumi/aws/ecr";

// Configures account with ECR, S3, and CodePipeline
export = async () => {
	const context = await Context.fromConfig();
	const _ = (name: string) => `${context.prefix}-${name}`;

	const ecr = (() => {
		const repository = new ECRRepository(_("binaries"));

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
