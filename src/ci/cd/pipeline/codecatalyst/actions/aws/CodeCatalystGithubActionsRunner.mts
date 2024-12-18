import type { GithubStep } from "../../../github/GithubStepBuilder.mjs";
import type { CodeCatalystAction } from "../../CodeCatalystActionBuilder.mjs";

export type CodeCatalystGithubActionsRunnerComputeSpec = {
	type: "EC2";
	Fleet: "Linux.x86-64.Large";
};

export type CodeCatalystGithubActionsRunnerInputsSpec<
	Sources extends string | "WorkflowSource",
	Artifacts extends string,
	Variables extends string,
> = {
	Sources?: Sources[];
	Artifacts?: Artifacts[];
	Variables?: {
		Name: Variables;
		Value: string;
	}[];
};

export type CodeCatalystGithubActionsRunnerOutputsSpec<
	Artifacts extends string,
	Variables extends string,
> = {
	Artifacts?: {
		Name: Artifacts;
		Files: string[];
	}[];
	AutoDiscoverReports?: {
		Enabled: boolean | true;
		ReportNamePrefix: string | "rpt";
	};
	Variables?: Variables[];
};

export type CodeCatalystGithubActionsRunnerEnvironmentSpec = {
	Name: string;
	Connections: {
		Name: string;
		Role: string;
	}[];
};

export type CodeCatalystGithubActionsRunnerCachingSpec = {
	FileCaching?: {
		[CacheName: string]: {
			RestoreKeys?: string[];
			Path: string;
		};
	};
};

export type CodeCatalystGithubActionsRunner<
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource";
		Artifacts: string;
		Variables: string;
	},
	Output extends {
		Artifacts: string;
		Variables: string;
	},
> = CodeCatalystAction<
	"aws/github-actions-runner@v1",
	"Steps" | "Container",
	{
		Steps: GithubStep<string, string>[];
	},
	{
		Compute?: CodeCatalystGithubActionsRunnerComputeSpec;
		Timeout?: number; // Timeout in minutes
		Environment?: CodeCatalystGithubActionsRunnerEnvironmentSpec;
		Inputs?: CodeCatalystGithubActionsRunnerInputsSpec<
			Input["Sources"],
			Input["Artifacts"],
			Input["Variables"]
		>;
		Outputs?: CodeCatalystGithubActionsRunnerOutputsSpec<
			Output["Artifacts"],
			Output["Variables"]
		>;
		DependsOn?: DependsOn[];
		Caching?: CodeCatalystGithubActionsRunnerCachingSpec;
	}
>;
