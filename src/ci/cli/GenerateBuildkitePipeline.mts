#!/usr/bin/env node --experimental-strip-types

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PipelineOptionsBuilder } from "../cd/pipeline/PipelineOptionsBuilder.mjs";
import {
	type BuildkiteBuild,
	BuildkitePipeline,
} from "../cd/pipeline/buildkite/BuildkitePipeline.mjs";
import type { SpawnOptions } from "../cd/runner/Spawn.mjs";
import { BuildkitePipelineCodegen } from "../codegen/pipeline/BuildkitePipelineCodegen.mjs";
import { uploadArtifact } from "../machine/Artifact.mjs";
import { executeSafe } from "../machine/Execute.mjs";
import { getCanaryRevision } from "../machine/code/Git.mjs";
import { printEnvironment } from "../machine/context/Environment.mjs";
import { isBuildkite } from "../machine/executor/Buildkite.mjs";
import { toYaml } from "../machine/format/Yaml.mjs";

async function writeBuildkitePipelineYaml({
	options,
	contentPath,
}: {
	options: PipelineOptionsBuilder<BuildkiteBuild>;
	contentPath: string;
}) {
	printEnvironment();

	const pipeline = BuildkitePipelineCodegen(options.build());
	if (pipeline === undefined) {
		console.dir(
			{
				Pipeline: {
					message: "Failed to generate pipeline",
					pipeline,
				},
			},
			{ depth: null },
		);

		throw new Error("Failed to generate pipeline");
	}

	const content = toYaml(pipeline);
	console.dir({
		Pipeline: {
			message: "Generated pipeline",
			path: contentPath,
			size: `${(content.length / 1024).toFixed()}KB`,
		},
	});

	try {
		mkdirSync(dirname(contentPath), { recursive: true });
	} catch (_) {}
	writeFileSync(contentPath, content);

	return options;
}

async function uploadBuildkitePipelineToAgent({
	contentPath,
	buildRelease,
}: {
	contentPath: string;
	buildRelease: boolean;
}) {
	console.log("Uploading artifact...");
	await uploadArtifact(contentPath);

	console.log("Setting canary revision...");
	const canaryRevision = buildRelease ? 0 : await getCanaryRevision();
	await executeSafe(
		["buildkite-agent", "meta-data", "set", "canary", `${canaryRevision}`],
		{
			stdio: "inherit",
		} as SpawnOptions,
	);

	console.log("Uploading pipeline...");
	await executeSafe(["buildkite-agent", "pipeline", "upload", contentPath], {
		stdio: "inherit",
	} as SpawnOptions);
}

export const GenerateBuildkitePipeline = async () => {
	const contentPath = join(process.cwd(), ".buildkite", "ci.yml");
	const { buildRelease } = await writeBuildkitePipelineYaml({
		options: await PipelineOptionsBuilder.for<BuildkiteBuild>(
			BuildkitePipeline.lastBuild,
			BuildkitePipeline.changedFiles,
			BuildkitePipeline.buildRelease,
		),
		contentPath,
	});

	if (isBuildkite) {
		await uploadBuildkitePipelineToAgent({
			contentPath,
			buildRelease: buildRelease,
		});
	} else {
		console.log("Not running in Buildkite, skipping pipeline upload.");
	}
};
