import type { CodeCatalystAction } from "../../CodeCatalystActionBuilder.mjs";

export type CodeCatalystTestStepsSpec = {
	Run: string;
};

export const CodeCatalystLinux86 = "CodeCatalystLinux_x86_64:2024_03";
export const CodeCatalystLinuxA64 = "CodeCatalystLinux_Arm64:2024_03";

export type CodeCatalystTestContainerSpec = {
	Registry: "CODECATALYST" | "ECR" | "DockerHub";
	Image: string;
};

export type CodeCatalystTestComputeSpec = {
	type: "EC2";
	Fleet:
		| `Linux.Arm64.${"X" | "2X" | ""}Large`
		| `Linux.x86-64.${"X" | "2X" | ""}Large`;
};

export type CodeCatalystTestCachingSpec = {
	FileCaching?: {
		[CacheName: string]: {
			RestoreKeys?: string[];
			Path: string;
		};
	};
};

export type CodeCatalystTestInputsSpec<
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

export type CodeCatalystTestOutputsSpec<
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

export type CodeCatalystTestPackagesSpec = {
	ExportAuthorizationToken?: boolean;
	NpmConfiguration?: {
		PackageRegistries?: {
			PackagesRepository: string;
			Scopes?: string[];
		}[];
	};
};

export type CodeCatalystTestAction<
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
	"aws/managed-test@v1.0.0",
	"Steps" | "Container",
	{
		Steps: CodeCatalystTestStepsSpec[];
		Container?: CodeCatalystTestContainerSpec;
		Timeout?: number;
	},
	{
		Compute?: CodeCatalystTestComputeSpec;
		Inputs?: CodeCatalystTestInputsSpec<
			Input["Sources"][number],
			Input["Artifacts"][number],
			Input["Variables"][number]["Name"]
		>;
		Outputs?: CodeCatalystTestOutputsSpec<
			Output["Artifacts"][number]["Name"],
			Output["Variables"][number]
		>;
		DependsOn?: DependsOn[];
		Packages?: CodeCatalystTestPackagesSpec;
		Timeout?: number;
		Caching?: CodeCatalystTestCachingSpec;
	}
>;
