import type { CodeCatalystAction } from "../../CodeCatalystActionBuilder.mjs";
import type { CodeCatalystStep } from "../../CodeCatalystStepBuilder.mjs";

export type CodeCatalystBuildStepsSpec = CodeCatalystStep;

export type CodeCatalystBuildContainerSpec = {
	Registry: "CODECATALYST" | "ECR" | "DockerHub";
	Image: string;
};

export type CodeCatalystBuildComputeSpec = {
	type: "EC2";
	Fleet: "Linux.Arm64.Large" | "Linux.x86-64.Large";
};

export type CodeCatalystBuildInputsSpec<
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

export type CodeCatalystBuildOutputsSpec<
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

export type CodeCatalystBuildPackagesSpec = {
	ExportAuthorizationToken?: boolean;
	NpmConfiguration?: {
		PackageRegistries?: {
			PackagesRepository: string;
			Scopes?: string[];
		}[];
	};
};

export type CodeCatalystBuildCachingSpec = {
	FileCaching?: {
		[CacheName: string]: {
			RestoreKeys?: string[];
			Path: string;
		};
	};
};

export type CodeCatalystBuildAction<
	DependsOn extends string,
	Input extends {
		Sources: string | "WorkflowSource"[];
		Artifacts: string[];
		Variables: {
			Name: string;
			Value: string;
		}[];
	},
	Output extends {
		Artifacts: {
			Name: string;
			Files: string[];
		}[];
		Variables: string[];
	},
> = CodeCatalystAction<
	"aws/build@v1.0.0",
	"Steps" | "Container",
	{
		Steps: CodeCatalystBuildStepsSpec[];
		Container?: CodeCatalystBuildContainerSpec;
	},
	{
		Compute?: CodeCatalystBuildComputeSpec;
		Inputs?: CodeCatalystBuildInputsSpec<
			Input["Sources"][number],
			Input["Artifacts"][number],
			Input["Variables"][number]["Name"]
		>;
		Outputs?: CodeCatalystBuildOutputsSpec<
			Output["Artifacts"][number]["Name"],
			Output["Variables"][number]
		>;
		DependsOn?: NoInfer<DependsOn>[];
		Packages?: CodeCatalystBuildPackagesSpec;
		Timeout?: number;
		Caching?: CodeCatalystBuildCachingSpec;
	}
>;
