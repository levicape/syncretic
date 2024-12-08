export class Pipeline {
	/**
	 * @param {number} [limit]
	 * @link https://buildkite.com/docs/pipelines/command-step#retry-attributes
	 */
	static getRetry = (limit = 0) => {
		return {
			automatic: [
				{ exit_status: 1, limit },
				{ exit_status: -1, limit: 3 },
				{ exit_status: 255, limit: 3 },
				{ signal_reason: "agent_stop", limit: 3 },
			],
		};
	};
}

export type PipelineOptions = {
	buildId?: string;
	buildImages?: boolean;
	publishImages?: boolean;
	skipTests?: boolean;
};
export type PipelineTargetSteps<Step> = {
	// getCheckoutStep: () => Step[];
	// getPackageManager: () => Step[];
	// getSetupRegistry: () => Readonly<Step[]>;
	// getListDependencies: () => Step[];
	// getInstall: () => Step[];
	// getTest: () => Step[];
	// getPublish: () => Step[];
};
export type PipelineInfraSteps<Step> = {
	getConfigureAws: () => Step[];
	getPackageManager: () => Step[];
	getPulumiInstall: () => Step[];
	getPulumiLogin: () => Step[];
	getPulumiPreview: () => Step[];
	getPulumiDeploy: () => Step[];
};
export type PipelineTarget<Step> = {
	$key: string;
	"runs-on": string;
	steps: Step[];
};
