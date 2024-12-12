export type PipelineRegistrySteps<Step> = {
	getSetupRegistry: () => Step[];
	getListImages: () => Step[];
};
