import type { AwsClient } from "aws4fetch";
import { z } from "zod";

type BuildStatusConfig = {
	context: string;
	targetUrl: string;
};

type GitSubmodulesConfig = {
	fetchSubmodules: boolean;
};

type Auth = {
	resource: string;
	type: string;
};
type ReportBuildStatusConfig = {
	context: string;
	targetUrl: string;
};

type ComputeType =
	| "BUILD_GENERAL1_SMALL"
	| "BUILD_GENERAL1_MEDIUM"
	| "BUILD_GENERAL1_LARGE"
	| "BUILD_GENERAL1_XLARGE"
	| "BUILD_GENERAL1_2XLARGE"
	| "BUILD_LAMBDA_1GB"
	| "BUILD_LAMBDA_2GB"
	| "BUILD_LAMBDA_4GB"
	| "BUILD_LAMBDA_8GB"
	| "BUILD_LAMBDA_10GB"
	| "ATTRIBUTE_BASED_COMPUTE";

type EnvironmentType =
	| "WINDOWS_CONTAINER"
	| "LINUX_CONTAINER"
	| "LINUX_GPU_CONTAINER"
	| "ARM_CONTAINER"
	| "WINDOWS_SERVER_2019_CONTAINER"
	| "LINUX_LAMBDA_CONTAINER"
	| "ARM_LAMBDA_CONTAINER"
	| "LINUX_EC2"
	| "ARM_EC2"
	| "WINDOWS_EC2"
	| "MAC_ARM";

const images = {
	ARM_CONTAINER: [
		"aws/codebuild/amazonlinux-aarch64-standard:2.0",
		"aws/codebuild/amazonlinux-aarch64-standard:3.0",
	] as const,
	ARM_LAMBDA_CONTAINER: [
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:dotnet6",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:dotnet8",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:go1.21",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:corretto11",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:corretto17",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:corretto21",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs18",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs20",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs22",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:python3.11",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:python3.12",
		"aws/codebuild/amazonlinux-aarch64-lambda-standard:ruby3.2",
	] as const,
	ARM_EC2: [
		"aws/codebuild/amazonlinux-aarch64-standard:2.0",
		"aws/codebuild/amazonlinux-aarch64-standard:3.0",
	] as const,
	LINUX_CONTAINER: [
		"aws/codebuild/standard:5.0",
		"aws/codebuild/standard:6.0",
		"aws/codebuild/standard:7.0",
	] as const,
	LINUX_LAMBDA_CONTAINER: [
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:dotnet6",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:dotnet8",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:go1.21",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:corretto11",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:corretto17",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:corretto21",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:nodejs18",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:nodejs20",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:python3.11",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:python3.12",
		"aws/codebuild/amazonlinux-x86_64-lambda-standard:ruby3.2",
	] as const,
	LINUX_EC2: [
		"aws/codebuild/amazonlinux-x86_64-standard:4.0",
		"aws/codebuild/amazonlinux-x86_64-standard:5.0",
		"aws/codebuild/amazonlinux-x86_64-standard:corretto8",
		"aws/codebuild/amazonlinux-x86_64-standard:corretto11",
		"aws/codebuild/amazonlinux-aarch64-standard:2.0",
		"aws/codebuild/amazonlinux-aarch64-standard:3.0",
		"aws/codebuild/standard:5.0",
		"aws/codebuild/standard:6.0",
		"aws/codebuild/standard:7.0",
	] as const,
	LINUX_GPU_CONTAINER: ["aws/codebuild/gpu:3.0"] as const,
	WINDOWS_CONTAINER: [
		"aws/codebuild/windows-base:2.0",
		"aws/codebuild/windows-base:3.0",
		"aws/codebuild/windows-base:4.0",
		"aws/codebuild/windows-base:5.0",
		"aws/codebuild/windows-base:6.0",
	] as const,
	WINDOWS_EC2: [
		"aws/codebuild/windows-base:2019-1.0",
		"aws/codebuild/windows-base:2019-2.0",
		"aws/codebuild/windows-base:2019-3.0",
		"aws/codebuild/windows-base:2022-1.0",
	] as const,
	WINDOWS_SERVER_2019_CONTAINER: [
		"aws/codebuild/windows-base:2019-1.0",
		"aws/codebuild/windows-base:2019-2.0",
		"aws/codebuild/windows-base:2019-3.0",
		"aws/codebuild/windows-base:2022-1.0",
	] as const,
	MAC_ARM: ["aws/codebuild/macos-arm-base:14"] as const,
};

type ImagesFor<T extends keyof typeof images> = (typeof images)[T][number];

type CredentialProviderType = "SECRETS_MANAGER";
type SourceAuth = {
	resource?: string;
	type: string;
};
type EnvironmentVariable = { Name: string; Value: string };
type ComputeConfiguration = {
	disk: number;
	machineType: string;
	memory: number;
	vCpu: number;
};
type RegistryCredential = {
	credential: string;
	credentialProvider: string;
};
type CloudWatchLogsConfig = {
	groupName: string;
	status: string;
	streamName: string;
};
type S3LogsConfig = {
	bucketOwnerAccess: string;
	encryptionDisabled: boolean;
	location: string;
	status: string;
};
type FileSystemLocation = {
	identifier: string;
	location: string;
	mountOptions: string;
	mountPoint: string;
	type: string;
};
type Restrictions = {
	computeTypesAllowed: string[];
	maximumBuildsAllowed: number;
};
type BuildBatchConfig = {
	batchReportMode: string;
	combineArtifacts: boolean;
	restrictions: Restrictions;
	serviceRole: string;
	timeoutInMins: number;
};
type ArtifactType = "CODEPIPELINE" | "NO_ARTIFACTS" | "S3";
type Artifact =
	| {
			artifactIdentifier?: string;
			bucketOwnerAccess?: string;
			encryptionDisabled?: boolean;
			location: string;
			name?: string;
			namespaceType?: string;
			overrideArtifactName?: boolean;
			packaging?: string;
			path?: string;
			type: Omit<ArtifactType, "NO_ARTIFACTS">;
	  }
	| { type: "NO_ARTIFACTS" };
type LogsConfig = {
	cloudWatchLogs?: CloudWatchLogsConfig;
	s3Logs?: S3LogsConfig;
};
type VpcConfig = {
	securityGroupIds: string[];
	subnets: string[];
	vpcId: string;
};
type Source = {
	auth?: SourceAuth;
	buildspec?: string;
	gitCloneDepth?: number;
	gitSubmodulesConfig?: GitSubmodulesConfig;
	insecureSsl?: boolean;
	location: string;
	reportBuildStatusConfig?: ReportBuildStatusConfig;
	sourceIdentifier?: string;
	type: SourceType;
};
type EnvironmentVariableType =
	| "PLAINTEXT"
	| "PARAMETER_STORE"
	| "SECRETS_MANAGER";
type SourceType = "CODECOMMIT" | "CODEPIPELINE" | "GITHUB" | "S3";
type CacheType = "NO_CACHE" | "LOCAL" | "S3";
type LogsConfigStatus = "ENABLED" | "DISABLED";
type ArtifactPackaging = "NONE" | "ZIP";
type ReportBuildStatus = "ENABLED" | "DISABLED";
type ImagePullCredentialsType = "CODEBUILD" | "SERVICE_ROLE";
type FileSystemLocationType = "EFS";
type CodebuildCreateProjectRequest<EnvironmentT extends EnvironmentType> = {
	artifacts: Artifact;
	autoRetryLimit?: number;
	badgeEnabled?: boolean;
	buildBatchConfig?: BuildBatchConfig;
	cache?: {
		location: string;
		modes: string[];
		type: string;
	};
	concurrentBuildLimit?: number;
	description?: string;
	encryptionKey?: string;
	environment: (
		| {
				computeType: ComputeType;
		  }
		| {
				computeType: "ATTRIBUTE_BASED_COMPUTE";
				computeConfiguration?: ComputeConfiguration;
		  }
	) & {
		certificate?: string;
		environmentVariables?: EnvironmentVariable[];
		fleet?: {
			fleetArn: string;
		};
		image: ImagesFor<EnvironmentT>;
		imagePullCredentialsType?: string;
		privilegedMode?: boolean;
		registryCredential?: RegistryCredential;
		type: EnvironmentType;
	};
	fileSystemLocations?: FileSystemLocation[];
	logsConfig?: LogsConfig;
	name: string;
	queuedTimeoutInMinutes?: number;
	secondaryArtifacts?: Artifact[];
	secondarySources?: Source[];
	serviceRole: string;
	source: Source;
	sourceVersion?: string;
	tags?: { key: string; value: string }[];
	timeoutInMinutes?: number;
	vpcConfig?: VpcConfig;
};

export class Codebuild {
	constructor(private client: AwsClient) {}

	async ImportSourceCredentials(request: {
		serverType:
			| "GITHUB"
			| "BITBUCKET"
			| "GITHUB_ENTERPRISE"
			| "GITLAB"
			| "GITLAB_SELF_MANAGED";
		authType:
			| "OAUTH"
			| "BASIC_AUTH"
			| "PERSONAL_ACCESS_TOKEN"
			| "SECRETS_MANAGER"
			| "CODECONNECTIONS";
		serverValue?: string;
		username?: string;
		token: string;
	}) {
		const response = await this.client.fetch(
			`https://codebuild.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "CodeBuild_20161006.ImportSourceCredentials",
				},
				body: JSON.stringify(request),
			},
		);

		if (response.status !== 200) {
			console.dir(
				{
					Codebuild: {
						status: response.status,
						statusText: response.statusText,
						body: await response.text(),
					},
				},
				{ depth: null },
			);
			throw new Error(
				`Failed to import source credentials: ${response.statusText}`,
			);
		}

		return z
			.object({
				arn: z.string(),
			})
			.parse(await response.json());
	}

	async CreateProject<EnvironmentT extends EnvironmentType>(
		request: CodebuildCreateProjectRequest<EnvironmentT>,
		{ iam }: { iam: string },
	) {
		const response = await this.client.fetch(
			`https://codebuild.${this.client.region}.amazonaws.com`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "CodeBuild_20161006.CreateProject",
				},
				body: JSON.stringify(request),
			},
		);

		if (response.status !== 200) {
			let body = await response.text();
			if (response.status === 400 && body.includes("ResourceAlreadyExists")) {
				return {
					project: {
						arn: `arn:aws:codebuild:${this.client.region}:${iam}:project/${request.name}"`,
					},
				};
			}
			console.dir(
				{
					Codebuild: {
						status: response.status,
						statusText: response.statusText,
						body,
					},
				},
				{ depth: null },
			);
			throw new Error(`Failed to create project: ${response.statusText}`);
		}

		return z
			.object({
				project: z.object({
					arn: z.string(),
					artifacts: z
						.object({
							artifactIdentifier: z.string().optional(),
							bucketOwnerAccess: z.string().optional(),
							encryptionDisabled: z.boolean().optional(),
							location: z.string().optional(),
							name: z.string().optional(),
							namespaceType: z.string().optional(),
							overrideArtifactName: z.boolean().optional(),
							packaging: z.string().optional(),
							path: z.string().optional(),
							type: z.string().optional(),
						})
						.optional(),
					badgeEnabled: z.boolean().optional(),
					buildBatchConfig: z
						.object({
							batchReportMode: z.string().optional(),
							combineArtifacts: z.boolean().optional(),
							restrictions: z
								.object({
									computeTypesAllowed: z.array(z.string()).optional(),
									maximumBuildsAllowed: z.number().optional(),
								})
								.optional(),
							serviceRole: z.string().optional(),
							timeoutInMins: z.number().optional(),
						})
						.optional(),
					cache: z
						.object({
							location: z.string().optional(),
							modes: z.array(z.string()).optional(),
							type: z.string().optional(),
						})
						.optional(),
					concurrentBuildLimit: z.number().optional(),
					created: z.number().optional(),
					description: z.string().optional(),
					encryptionKey: z.string().optional(),
					environment: z
						.object({
							certificate: z.string().optional(),
							computeConfiguration: z
								.object({
									disk: z.number().optional(),
									machineType: z.string().optional(),
									memory: z.number().optional(),
									vCpu: z.number().optional(),
								})
								.optional(),
							computeType: z.string().optional(),
							environmentVariables: z
								.array(
									z
										.object({
											Name: z.string().optional(),
											Value: z.string().optional(),
										})
										.optional(),
								)
								.optional(),
							fleet: z
								.object({
									fleetArn: z.string(),
								})
								.optional()
								.optional(),
							image: z.string().optional(),
							imagePullCredentialsType: z.string().optional(),
							privilegedMode: z.boolean().optional(),
							registryCredential: z
								.object({
									credential: z.string().optional(),
									credentialProvider: z.string().optional(),
								})
								.optional(),
							type: z.string().optional(),
						})
						.optional(),
					fileSystemLocations: z
						.array(
							z
								.object({
									identifier: z.string().optional(),
									location: z.string().optional(),
									mountOptions: z.string().optional(),
									mountPoint: z.string().optional(),
									type: z.string().optional(),
								})
								.optional(),
						)
						.optional(),
					lastModified: z.number().optional(),
					logsConfig: z
						.object({
							cloudWatchLogs: z
								.object({
									groupName: z.string().optional(),
									status: z.string().optional(),
									streamName: z.string().optional(),
								})
								.optional(),
							s3Logs: z
								.object({
									bucketOwnerAccess: z.string().optional(),
									encryptionDisabled: z.boolean().optional(),
									location: z.string().optional(),
									status: z.string().optional(),
								})
								.optional(),
						})
						.optional(),
					name: z.string().optional(),
					queuedTimeoutInMinutes: z.number().optional(),
					secondaryArtifacts: z
						.array(
							z
								.object({
									artifactIdentifier: z.string().optional(),
									bucketOwnerAccess: z.string().optional(),
									encryptionDisabled: z.boolean().optional(),
									location: z.string().optional(),
									name: z.string().optional(),
									namespaceType: z.string().optional(),
									overrideArtifactName: z.boolean().optional(),
									packaging: z.string().optional(),
									path: z.string().optional(),
									type: z.string().optional(),
								})
								.optional(),
						)
						.optional(),
					secondarySources: z
						.array(
							z
								.object({
									auth: z
										.object({
											resource: z.string().optional(),
											type: z.string().optional(),
										})
										.optional(),
									buildspec: z.string().optional(),
									gitCloneDepth: z.number().optional(),
									gitSubmodulesConfig: z
										.object({
											fetchSubmodules: z.boolean().optional(),
										})
										.optional(),
									insecureSsl: z.boolean().optional(),
									location: z.string().optional(),
									reportBuildStatusConfig: z
										.object({
											context: z.string().optional(),
											targetUrl: z.string().optional(),
										})
										.optional(),
									sourceIdentifier: z.string().optional(),
									sourceType: z.string().optional(),
								})
								.optional(),
						)
						.optional(),
					serviceRole: z.string().optional(),
					source: z
						.object({
							auth: z
								.object({
									resource: z.string().optional(),
									type: z.string().optional(),
								})
								.optional(),
							buildspec: z.string().optional(),
							gitCloneDepth: z.number().optional(),
							gitSubmodulesConfig: z
								.object({
									fetchSubmodules: z.boolean().optional(),
								})
								.optional(),
							insecureSsl: z.boolean().optional(),
							location: z.string().optional(),
							reportBuildStatusConfig: z
								.object({
									context: z.string().optional(),
									targetUrl: z.string().optional(),
								})
								.optional(),
							sourceIdentifier: z.string().optional(),
							sourceType: z.string().optional(),
						})
						.optional(),
					sourceVersion: z.string().optional(),
					tags: z
						.array(
							z
								.object({
									key: z.string().optional(),
									value: z.string().optional(),
								})
								.optional(),
						)
						.optional(),
					timeoutInMinutes: z.number().optional(),
					vpcConfig: z
						.object({
							securityGroupIds: z.array(z.string()).optional(),
							subnets: z.array(z.string()).optional(),
							vpcId: z.string().optional(),
						})
						.optional(),
				}),
			})
			.parse(await response.json());
	}
}
