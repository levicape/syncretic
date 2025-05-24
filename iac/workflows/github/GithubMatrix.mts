import type {
	GithubOn,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/github";
import type { CodeCatalystComputeSpec } from "../../../module/jsx/codecatalyst/CodeCatalystWorkflow.mts";

const ENVIRONMENT = "sage";
export const GITHUB_CI_MATRIX = [
	{
		name: `Dispatch: Preview, Deploy, Push`,
		region: "us-west-2",
		triggers: {
			workflow_dispatch: {},
		} satisfies GithubOn,
		pipeline: {
			install: undefined as unknown as GithubWorkflowProps<
				boolean,
				boolean
			>["pipeline"]["install"],
			environment: {
				name: "${{ vars.CI_ENVIRONMENT }}",
			},
			preview: true as const,
			deploy: true as const,
			push: true as const,
		},
	},
	{
		name: `Dispatch: Delete`,
		region: "us-west-2",
		triggers: {
			workflow_dispatch: {},
		} satisfies GithubOn,
		pipeline: {
			install: undefined as unknown as GithubWorkflowProps<
				boolean,
				boolean
			>["pipeline"]["install"],
			environment: {
				name: "${{ vars.CI_ENVIRONMENT }}",
			},
			// 		approval: true as const,
			preview: true as const,
			delete: true as const,
		},
	},
	// {
	// 	name: `on Push: Preview, Deploy`,
	// 	region: "us-west-2",
	// 	triggers: {
	// 		workflow_dispatch: {},
	// 	} satisfies GithubOn,
	// 	pipeline: {
	// 		install: undefined as unknown as GithubWorkflowProps<
	// 			boolean,
	// 			boolean
	// 		>["pipeline"]["install"],
	// 		environment: {
	// 			name: ENVIRONMENT,
	// 		},
	//		approval: true as const,
	// 		preview: true as const,
	// 		deploy: true as const,
	// 		push: true as const,
	// 	},
	// },
	// {
	// 	name: `on Pull Request: Preview`,
	// 	region: "us-west-2",
	// 	triggers: {
	// 		schedule: [
	// 			{
	// 				cron: "0 0 * * *",
	// 			},
	// 		],
	// 	} satisfies GithubOn,
	// 	pipeline: {
	// 		install: undefined as unknown as GithubWorkflowProps<
	// 			boolean,
	// 			boolean
	// 		>["pipeline"]["install"],
	// 		environment: {
	// 			name: ENVIRONMENT,
	// 		},
	// 		approval: true as const,
	// 		preview: true as const,
	// 		deploy: false as const,
	// 		push: false as const,
	// 	},
	// },
	// {
	// 	name: `on Schedule: Preview`,
	// 	region: "us-west-2",
	// 	triggers: {
	// 		schedule: [
	// 			{
	// 				cron: "0 0 * * *",
	// 			},
	// 		],
	// 	} satisfies GithubOn,
	// 	pipeline: {
	// 		install: undefined as unknown as GithubWorkflowProps<
	// 			boolean,
	// 			boolean
	// 		>["pipeline"]["install"],
	// 		environment: {
	// 			// Matrix
	// 			name: ENVIRONMENT,
	// 		},
	// 		preview: true as const,
	// 		deploy: false as const,
	// 		push: false as const,
	// 	},
	// },
].map((ci) => {
	ci.pipeline.install = {
		npm: {
			LEVICAPE: {
				scope: "@levicape",
				token: ({ current: { secret } }) => {
					return secret("LEVICAPE_NPM_TOKEN");
				},
				protocol: "https",
				host: "npm.pkg.github.com",
			},
		},
	};
	return ci;
}) satisfies Array<GithubWorkflowProps<boolean, boolean>>;

export type GithubWorkflowProps<
	Preview extends boolean,
	Deploy extends boolean,
> = {
	name: string;
	region: string;
	triggers: GithubOn;
	compute?: CodeCatalystComputeSpec;
	pipeline: {
		install: {
			npm: Record<
				string,
				{
					scope: string;
					token: (expresssions: typeof GithubWorkflowExpressions) => string;
					protocol: string;
					host: string;
				}
			>;
		};
	} & (Preview extends true
		? {
				environment: {
					name: string;
				};
				preview: Preview;
				deploy?: Deploy;
			}
		: {
				environment: {
					name: string;
				};
				preview: Preview;
				deploy?: false;
			}) &
		(Deploy extends true
			? {
					push?: boolean;
					delete?: false;
				}
			: {
					push?: false;
					delete?: boolean;
				});
};
