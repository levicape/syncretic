import { hash } from "node:crypto";
import { basename, extname } from "node:path";
import { Context, Effect } from "effect";
import { process } from "std-env";
import VError from "verror";
import { stringify } from "yaml";
import {
	LoggingContext,
	withStructuredLogging,
} from "../../../server/logging/LoggingContext.mjs";
import type {
	GithubOnPushSpec,
	GithubOnScheduleSpec,
	GithubPullRequestSpec,
	GithubWorkflowBuilder,
} from "../../cd/pipeline/github/GithubWorkflowBuilder.mjs";
import { GithubWorkflowExpressions } from "../../cd/pipeline/github/GithubWorkflowExpressions.mjs";
import { GenerateWorkflowTemplate } from "../pipeline/GenerateWorkflowTemplate.mjs";

export const GenerateGithubWorkflow = async function* () {
	const then = Date.now();

	const { logger } = await Effect.runPromise(
		Effect.provide(
			Effect.gen(function* () {
				const consola = yield* LoggingContext;
				const logger = yield* consola.logger;

				return { logger };
			}),
			Context.empty().pipe(
				withStructuredLogging({ prefix: "GenerateGithubWorkflow" }),
			),
		),
	);

	logger.info("Waiting for workflow");
	const {
		workflow,
		source,
	}: {
		workflow: GithubWorkflowBuilder<string, string>;
		source: string;
	} = yield {
		$state: "workflow",
	} as const;

	let rendered = workflow.build();

	if (workflow === undefined || rendered === undefined) {
		logger
			.withMetadata({
				GenerateGithubWorkflow: {
					workflow,
				},
			})
			.error("Failed to generate workflow");

		throw new VError("Failed to generate workflow");
	}

	let filename = ``;
	{
		let named = ``;
		Object.entries(rendered.on).forEach(([name, value]) => {
			if (name === "push") {
				let pushspec = value as GithubOnPushSpec;
				named += `[push`;
				if (pushspec.branches) {
					named += `(b:${pushspec.branches
						.map((b) => b.replaceAll("/", "__"))
						.join("|")})`;
				}
				if (pushspec["branches-ignore"]) {
					named += `(!b:${pushspec["branches-ignore"]
						.map((b) => b.replaceAll("/", "__"))
						.join("|")})`;
				}
				if (pushspec.tags) {
					named += `(t:${pushspec.tags
						.map((t) => t.replaceAll("/", "__"))
						.join("|")})`;
				}
				if (pushspec["tags-ignore"]) {
					named += `(!t:${pushspec["tags-ignore"]
						.map((t) => t.replaceAll("/", "__"))
						.join("|")})`;
				}
				if (pushspec.paths) {
					named += `(p:${pushspec.paths
						.map((p) => p.replaceAll("/", "__"))
						.join("|")})`;
				}
				if (pushspec["paths-ignore"]) {
					named += `(!p:${pushspec["paths-ignore"]
						.map((p) => p.replaceAll("/", "__"))
						.join("|")})`;
				}
				named += `]`;
			}

			if (name === "pull_request") {
				let pullspec = value as GithubPullRequestSpec;
				named += `[pr`;

				if (pullspec.branches) {
					named += `[${pullspec.branches
						.map((b) => b.replaceAll("/", "__"))
						.join("|")}]`;
				}

				if (pullspec["branches-ignore"]) {
					named += `[!${pullspec["branches-ignore"]
						.map((b) => b.replaceAll("/", "__"))
						.join("|")}]`;
				}

				if (pullspec.paths) {
					named += `[${pullspec.paths
						.map((p) => p.replaceAll("/", "__"))
						.join("|")}]`;
				}

				if (pullspec["paths-ignore"]) {
					named += `[!${pullspec["paths-ignore"]
						.map((p) => p.replaceAll("/", "__"))
						.join("|")}]`;
				}

				named += `]`;
			}

			if (name === "workflow_dispatch") {
				named += `[wd`;
				let dispatch = value as {
					inputs: Record<
						string,
						{
							description: string;
							required: boolean;
							default: string;
							type: "string" | "number" | "boolean";
						}
					>;
					outputs: Record<string, { description: string; value: string }>;
				};
				if (dispatch.inputs) {
					named += `(${Object.keys(dispatch.inputs).join("|")})`;
				}
				if (dispatch.outputs) {
					named += `(${Object.keys(dispatch.outputs).join("|")})`;
				}
				named += `]`;
			}

			if (name === "schedule") {
				named += `[schedule`;
				let schedule = value as GithubOnScheduleSpec;
				if (!Array.isArray(schedule) || schedule.length === 0) {
					throw new VError("Schedule workflows must have at least one element");
				}
				let text = schedule.find(() => true)?.cron.replaceAll(" ", "_");
				named += `(${text ?? "cron"})`;
				named += `]`;
			}

			if (name === "release") {
				named += `[release`;
				let releasespec = value as { types: "released"[] };
				if (releasespec.types) {
					named += `(${releasespec.types.join("|")})`;
				}
				named += `]`;
			}

			if (name === "repository_dispatch") {
				named += `[rd]`;
			}

			if (name === "workflow_dispatch") {
				named += `[dispatch]`;
			}

			if (name === "workflow_call") {
				named += `[wc]`;
			}
		});
		filename = `${named} - ${basename(source, extname(source))} - [${rendered.name}].yml`;
	}

	console.warn({
		rendered: rendered.on,
	});
	const yaml = stringify(rendered, {
		collectionStyle: "block",
		aliasDuplicateObjects: false,
		doubleQuotedAsJSON: true,
		minContentWidth: 0,
		lineWidth: 0,
	});
	const hashed = hash("sha256", yaml);
	// {
	// 	// TODO: support ssm://, file:// and stdin
	// 	let signed = ``;
	// 	let publicKey = undefined;
	// 	let privateKey = undefined;
	// 	let passphrase = undefined;
	// 	if (publicKey) {
	// 		signed = publicEncrypt(
	// 			`-----BEGIN PUBLIC KEY-----
	// 	MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgF9EHjZWbqJpUV8uby1lN6yMiF9u
	// 	A5kAO15gaXmyjBJecuCOrWck1k1eGDXNaZhLX0hhc1G/JuszvZTMQC42v8mP7Tpf
	// 	1Un+1pe/RUaGa2q0uX9zdpdGS0uLbXdBB330CH4oODSqbKdrg6l2pIVLmL6PuUHf
	// 	FW5696TDNfUus72BAgMBAAE=
	// 	-----END PUBLIC KEY-----`,
	// 			hashed,
	// 		).toString("hex");
	// 	}
	// }
	const now = Date.now();
	const content = GenerateWorkflowTemplate({
		cwd: process?.cwd?.() ?? "$PWD",
		filename,
		source,
		yaml,
		hashed,
		generator:
			(import.meta as { filename?: string })?.filename
				?.split("/")
				.slice(-3)
				.join("/") ?? "",
		then,
		now,
	});

	logger
		.withMetadata({
			GenerateGithubWorkflow: {
				size: `${(content.length / 1024).toFixed()}KB`,
			},
		})
		.info("Generated workflow");
	yield { $state: "content", content, workflow } as const;

	const state = GithubWorkflowExpressions.getState();

	logger
		.withMetadata({
			CurrentState: {
				state,
			},
		})
		.info("Current generation state");
	yield { $state: "validate", state } as const;

	return { $state: "done", filename, content, hashed } as const;
};
