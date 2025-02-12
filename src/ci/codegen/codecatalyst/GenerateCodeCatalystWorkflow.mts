import { hash } from "node:crypto";
import { basename, extname } from "node:path";
import { WorkflowDefinition } from "@aws/codecatalyst-workflows-sdk";
import { Context, Effect } from "effect";
import { load } from "js-yaml";
import { process } from "std-env";
import VError from "verror";
import { stringify } from "yaml";
import {
	LoggingContext,
	withStructuredLogging,
} from "../../../server/logging/LoggingContext.mjs";
import type { CodeCatalystWorkflowBuilder } from "../../cd/pipeline/codecatalyst/CodeCatalystWorkflowBuilder.mjs";
import type { CodeCatalystPullrequestTriggerSpec } from "../../cd/pipeline/codecatalyst/triggers/CodeCatalystPullrequestTrigger.mjs";
import type { CodeCatalystPushTriggerSpec } from "../../cd/pipeline/codecatalyst/triggers/CodeCatalystPushTrigger.mjs";
import type { CodeCatalystScheduleTriggerSpec } from "../../cd/pipeline/codecatalyst/triggers/CodeCatalystScheduleTrigger.mjs";
import { GenerateWorkflowTemplate } from "../../codegen/pipeline/GenerateWorkflowTemplate.mjs";

export const GenerateCodeCatalystWorkflow = async function* () {
	const { logger } = await Effect.runPromise(
		Effect.provide(
			Effect.gen(function* () {
				const consola = yield* LoggingContext;
				const logger = yield* consola.logger;

				return { logger };
			}),
			Context.empty().pipe(withStructuredLogging({ prefix: "CLI" })),
		),
	);

	const then = Date.now();
	logger.info("Waiting for workflow");
	const {
		workflow,
		source,
	}: {
		workflow: CodeCatalystWorkflowBuilder<
			string,
			string,
			string,
			{
				Sources: string | "WorkflowSource"[];
				Artifacts: string[];
				Variables: {
					Name: string;
					Value: string;
				}[];
			},
			{
				Artifacts: {
					Name: string;
					Files: string[];
				}[];
				Variables: string[];
			}
		>;
		source: string;
	} = yield {
		$state: "workflow",
	} as const;

	let rendered = workflow.build();

	if (workflow === undefined || rendered === undefined) {
		logger
			.withMetadata({
				GenerateCodeCatalystWorkflow: {
					workflow,
				},
			})
			.error("Failed to generate workflow");

		throw new VError("Failed to generate workflow");
	}

	let filename = ``;
	{
		let named = ``;
		rendered.Triggers.forEach((trigger) => {
			const { Type } = trigger;
			if (Type === "PUSH") {
				let pushspec = trigger as CodeCatalystPushTriggerSpec;
				named += `[push`;
				if (pushspec.Branches) {
					named += `(b:${pushspec.Branches.map((b) =>
						b.replaceAll("/", "__"),
					).join("|")})`;
				}
				named += `]`;
			}

			if (Type === "PULLREQUEST") {
				let pullspec = trigger as CodeCatalystPullrequestTriggerSpec;
				named += `[pr`;

				if (pullspec.Events) {
					named += `(${pullspec.Events})`;
				}

				if (pullspec.Branches) {
					named += `(b:${pullspec.Branches.map((b) =>
						b.replaceAll("/", "__"),
					).join("|")})`;
				}

				if (pullspec.FilesChanged) {
					named += `(f:${pullspec.FilesChanged.map((f) =>
						f.replaceAll("/", "__"),
					).join("|")})`;
				}

				named += `]`;
			}

			if (Type === "SCHEDULE") {
				named += `[schedule`;
				let schedulespec = trigger as CodeCatalystScheduleTriggerSpec;
				if (schedulespec.Expression) {
					named += `(${schedulespec.Expression.replaceAll(" ", "_")})`;
				}
				named += `]`;
			}
		});
		filename = `${named}${basename(source, extname(source))}.yml`;
	}

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
			GenerateCodeCatalystWorkflow: {
				size: `${(content.length / 1024).toFixed()}KB`,
			},
		})
		.info("Generated workflow");
	yield { $state: "content", content, workflow } as const;

	const schema = WorkflowDefinition.validate(load(content));

	logger
		.withMetadata({
			GenerateCodeCatalystWorkflow: {
				schema,
			},
		})
		.info("Validated workflow");

	let errors = schema.errors;
	yield {
		$state: "validate",
		result: {
			errors: errors.map((e) => e.message),
		},
	} as const;

	return { $state: "done", filename, content, hashed } as const;
};
