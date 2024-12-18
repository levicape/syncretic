export type PipelinePackageOptions<Options> = {
	packageManager: {
		node: "npm" | "pnpm" | "yarn";
		cache?: boolean;
	};
	registry: {
		scope: string;
		host: string;
		secret?: string;
	};
} & Options;

export type PipelinePackageSteps<Step, Props> = {
	getCheckoutStep: (props: Props) => Step[];
	getPackageManager: (props: Props) => Step[];
	getRuntime: (props: Props) => Step[];
	getInstallModules: (props: Props) => Step[];
	getScript: <Options>(
		props: Props,
	) => (script: string, options: Options) => Step;
};
