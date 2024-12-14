import { hash, publicEncrypt } from "node:crypto";
import ms from "pretty-ms";
import VError from "verror";
import { stringify } from "yaml";
import type { GithubPipelineBuilder } from "../../cd/pipeline/github/GithubPipelineBuilder.mjs";
import { CurrentState } from "../../cd/state/CurrentState.mjs";

export const GenerateGithubPipeline = async function* () {
	const then = Date.now();
	console.dir({
		GenerateGithubPipeline: {
			message: "Waiting for pipeline",
		},
	});
	const pipeline: GithubPipelineBuilder<string, string> = yield {
		$state: "pipeline",
	} as const;

	let rendered = pipeline.build();

	if (pipeline === undefined || rendered === undefined) {
		console.dir(
			{
				GenerateGithubPipeline: {
					message: "Failed to generate pipeline",
					pipeline,
				},
			},
			{ depth: null },
		);

		throw new VError("Failed to generate pipeline");
	}

	const yaml = stringify(rendered, {
		collectionStyle: "block",
		doubleQuotedAsJSON: true,
		minContentWidth: 0,
		lineWidth: 0,
	});
	const hashed = hash("sha256", yaml);
	// TODO: Prompt with --sign, or --sign-key, or use a --sign-path supporting ssm:// and file:// paths
	const signed = publicEncrypt(
		`-----BEGIN PUBLIC KEY-----
MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgF9EHjZWbqJpUV8uby1lN6yMiF9u
A5kAO15gaXmyjBJecuCOrWck1k1eGDXNaZhLX0hhc1G/JuszvZTMQC42v8mP7Tpf
1Un+1pe/RUaGa2q0uX9zdpdGS0uLbXdBB330CH4oODSqbKdrg6l2pIVLmL6PuUHf
FW5696TDNfUus72BAgMBAAE=
-----END PUBLIC KEY-----`,
		hashed,
	).toString("hex");
	const now = Date.now();
	const content = `
# THIS FILE WAS AUTOMATICALLY GENERATED, DO NOT MODIFY
# .../${import.meta?.filename?.split("/").slice(-3).join("/") ?? ""}
########################################
${yaml}
########################################
########################################
# ${JSON.stringify({ started: new Date(then).toISOString(), now: new Date(now).toISOString(), elapsed: ms(now - then), hashed, signed })}
# END OF GENERATED FILE

`;
	console.dir({
		GenerateGithubPipeline: {
			message: "Generated pipeline",
			size: `${(content.length / 1024).toFixed()}KB`,
		},
	});
	yield { $state: "content", content, pipeline } as const;

	const state = CurrentState.getState();
	console.dir(
		{
			CurrentState: {
				message: "Current state",
				state,
			},
		},
		{ depth: null },
	);
	yield { $state: "validate", state } as const;

	return { $state: "done" } as const;
};
