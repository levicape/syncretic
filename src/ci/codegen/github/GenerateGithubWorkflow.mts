import { hash } from "node:crypto";
import { basename, extname } from "node:path";
import VError from "verror";
import { stringify } from "yaml";
import type {
	GithubOnPushSpec,
	GithubPullRequestSpec,
	GithubWorkflowBuilder,
} from "../../cd/pipeline/github/GithubWorkflowBuilder.mjs";
import { GithubWorkflowExpressions } from "../../cd/pipeline/github/GithubWorkflowExpressions.mjs";
import { GenerateWorkflowTemplate } from "../index.mjs";

const pathToWorkflows = (named: string) => `/.github/workflows/${named}.yml`;

export const GenerateGithubWorkflow = async function* () {
	const then = Date.now();
	console.dir({
		GenerateGithubWorkflow: {
			message: "Waiting for workflow",
		},
	});
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
		console.dir(
			{
				GenerateGithubWorkflow: {
					message: "Failed to generate workflow",
					workflow,
				},
			},
			{ depth: null },
		);

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
				let schedule = (value as string).replaceAll(" ", "_");
				named += `(${schedule})`;
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
		filename = `${named}${basename(source, extname(source))}.yml`;
	}

	const yaml = stringify(rendered, {
		collectionStyle: "block",
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
		cwd: process.cwd(),
		filename,
		source,
		yaml,
		hashed,
		generator: import.meta?.filename?.split("/").slice(-3).join("/") ?? "",
		then,
		now,
	});

	console.dir({
		GenerateGithubWorkflow: {
			message: "Generated workflow",
			size: `${(content.length / 1024).toFixed()}KB`,
		},
	});
	yield { $state: "content", content, workflow } as const;

	const state = GithubWorkflowExpressions.getState();
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

	return { $state: "done", filename, content } as const;
};
