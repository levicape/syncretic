import type {
	CodeCatalystComputeSpec,
	CodeCatalystTriggersSpec,
	CodeCatalystWorkflowExpressions,
} from "@levicape/fourtwo/codecatalyst";

export const CODECATALYST_CI_MATRIX = [
	{
		name: "Main__Image_Preview_Deploy_Push__current",
		region: "us-west-2",
		triggers: [],
		pipeline: {
			install: undefined as unknown as CodeCatalystWorkflowProps<
				boolean,
				boolean
			>["pipeline"]["install"],
			environment: {
				name: "current",
			},
			image: true as const,
			preview: true as const,
			deploy: true as const,
			push: true as const,
		},
	},
	{
		name: "Main__Image_Preview_Deploy__current",
		region: "us-west-2",
		triggers: [
			{
				Type: "SCHEDULE" as const,
				Expression: "0 0 * * ? *",
				Branches: ["main"],
			},
		],
		pipeline: {
			install: undefined as unknown as CodeCatalystWorkflowProps<
				boolean,
				boolean
			>["pipeline"]["install"],
			environment: {
				name: "current",
			},
			image: true as const,
			preview: true as const,
			deploy: true as const,
			push: false as const,
		},
	},
	{
		name: "Main__Image_Preview__current",
		region: "us-west-2",
		triggers: [
			{
				Type: "PULLREQUEST" as const,
				Events: ["OPEN", "REVISION"] as const,
				Branches: ["main"],
			},
		],
		pipeline: {
			install: undefined as unknown as CodeCatalystWorkflowProps<
				boolean,
				boolean
			>["pipeline"]["install"],
			environment: {
				name: "current",
			},
			image: true as const,
			preview: true as const,
			deploy: false as const,
			push: false as const,
		},
	},
].map((ci) => {
	ci.pipeline.install = {
		npm: {
			LEVICAPE: {
				scope: "@levicape",
				token: ({ current: { context: _$_ } }) => {
					return _$_("Secrets.GITHUB_LEVICAPE_PAT");
				},
				protocol: "https",
				host: "npm.pkg.github.com",
			},
		},
	};
	return ci;
}) satisfies Array<CodeCatalystWorkflowProps<boolean, boolean>>;

export type CodeCatalystWorkflowProps<
	Preview extends boolean,
	Deploy extends boolean,
> = {
	name: string;
	region: string;
	triggers: CodeCatalystTriggersSpec[];
	compute?: CodeCatalystComputeSpec;
	pipeline: {
		install: {
			npm: Record<
				string,
				{
					scope: string;
					token: (
						expresssions: typeof CodeCatalystWorkflowExpressions,
					) => string;
					protocol: string;
					host: string;
				}
			>;
		};
		image?: Preview extends true ? true : false;
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
				}
			: {
					push?: false;
				});
};
