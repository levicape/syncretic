export type PipelineDeployOptions = {
	previewOnly?: boolean;
};

export type PipelineDeploySteps<Step, Props> = {
	// getInstall: (props: Props) => Step[];
	// getLogin: (props: Props) => Step[];
	// getPreview: (props: Props) => Step[];
	// getDeploy: (props: Props) => Step[];
};
