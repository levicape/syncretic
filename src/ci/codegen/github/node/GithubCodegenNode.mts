import {
	type GithubNodePipelineJobProps,
	GithubNodePipelineJobScripts,
	GithubNodePipelineJobSetup,
} from "./GithubNodePipelineJobCodegen.mjs";

export const GithubPipelineNodeSetupX = (
	props: Parameters<typeof GithubNodePipelineJobSetup>[0],
) => {
	return GithubNodePipelineJobSetup(props).steps;
};

export const GithubPipelineNodeScriptsX = (
	props: Parameters<typeof GithubNodePipelineJobScripts>[0],
) => {
	return GithubNodePipelineJobScripts(props).steps;
};
