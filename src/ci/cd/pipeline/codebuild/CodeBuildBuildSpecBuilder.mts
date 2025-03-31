import VError from "verror";

export type CodeBuildBuildspecVersion = 0.2;
export type CodeBuildBuildSpecStringBoolean = "yes" | "no";

export type CodeBuildBuildspecResourceLambdaPhaseSpec = {
	// "run-as"?: string;
	"on-failure"?:
		| "ABORT"
		| "CONTINUE"
		| `RETRY${"" | `-${number | `${number}-${string}`}`}`;
	commands: Array<string>;
	finally?: Array<string>;
};

export type CodebuildBuildSpecSecretId = string;
export type CodebuildBuildSpecSecretJsonKey = string;
export type CodebuildBuildSpecSecretVersionStage = string;
export type CodebuildBuildSpecSecretVersionId = string;
export type CodebuildBuildSpecSecretmanagerTemplateString =
	| `${CodebuildBuildSpecSecretId}:${CodebuildBuildSpecSecretJsonKey}`
	| `${CodebuildBuildSpecSecretId}:${CodebuildBuildSpecSecretJsonKey}:${CodebuildBuildSpecSecretVersionStage}`
	| `${CodebuildBuildSpecSecretId}:${CodebuildBuildSpecSecretJsonKey}:${CodebuildBuildSpecSecretVersionStage}:${CodebuildBuildSpecSecretVersionId}`;

export type CodeBuildBuildspecLambda = {
	version: CodeBuildBuildspecVersion;
	// "run-as"?: string;
	proxy?: {
		"upload-artifacts"?: CodeBuildBuildSpecStringBoolean;
		logs?: CodeBuildBuildSpecStringBoolean;
	};
	batch?: {
		"fast-fail"?: CodeBuildBuildSpecStringBoolean;
	};
	cache?: {
		paths: Array<string>;
	};
	reports?: Record<
		string,
		{
			files: Array<string>;
			"base-directory"?: string;
			"discard-paths"?: CodeBuildBuildSpecStringBoolean;
			"file-format"?: "JUNITXML" | "JSON" | "HTML";
		}
	>;
	artifacts?: {
		files: Array<string>;
		name?: string;
		"base-directory"?: string;
		"exclude-paths"?: Array<string>;
		"enable-symlinks"?: CodeBuildBuildSpecStringBoolean;
		"s3-prefix"?: string;
	};
	env?: {
		shell?: "bash" | "/bin/sh";
		variables?: Record<string, string>;
		"parameter-store"?: Record<string, string>;
		"secrets-manager"?: Record<
			string,
			CodebuildBuildSpecSecretmanagerTemplateString
		>;
		"exported-variables"?: Array<string>;
		"git-credential-helper"?: CodeBuildBuildSpecStringBoolean;
	};
	phases: {
		install?: CodeBuildBuildspecResourceLambdaPhaseSpec;
		pre_build?: CodeBuildBuildspecResourceLambdaPhaseSpec;
		build?: CodeBuildBuildspecResourceLambdaPhaseSpec;
		post_build?: CodeBuildBuildspecResourceLambdaPhaseSpec;
	};
};

export type CodeBuildBuildspec = CodeBuildBuildspecLambda;

export class CodebuildBuildSpecProxyBuilder {
	private _uploadArtifacts: CodeBuildBuildSpecStringBoolean = "no";
	private _logs: CodeBuildBuildSpecStringBoolean = "no";

	setUploadArtifacts(uploadArtifacts: CodeBuildBuildSpecStringBoolean) {
		this._uploadArtifacts = uploadArtifacts;
		return this;
	}

	setLogs(logs: CodeBuildBuildSpecStringBoolean) {
		this._logs = logs;
		return this;
	}

	build(): CodeBuildBuildspec["proxy"] {
		return {
			"upload-artifacts": this._uploadArtifacts,
			logs: this._logs,
		};
	}
}

export type CodeBuildBuildspecBatch = CodeBuildBuildspec["batch"];

export class CodeBuildBuildspecBatchBuilder {
	private _fastFail: CodeBuildBuildSpecStringBoolean = "no";

	setFastFail(fastFail: CodeBuildBuildSpecStringBoolean) {
		this._fastFail = fastFail;
		return this;
	}

	build(): CodeBuildBuildspecBatch {
		return {
			"fast-fail": this._fastFail,
		};
	}
}

export type CodeBuildBuildspecCache = CodeBuildBuildspec["cache"];

export class CodeBuildBuildspecCacheBuilder {
	private _paths: Array<string> = [];

	addPath(path: string) {
		this._paths.push(path);
		return this;
	}

	setPaths(paths: Array<string>) {
		this._paths = paths;
		return this;
	}

	build(): CodeBuildBuildspecCache {
		return {
			paths: this._paths,
		};
	}
}

export type CodeBuildBuildspecReports = CodeBuildBuildspec["reports"];
export class CodeBuildBuildspecReportsBuilder {
	private _reports: Record<
		string,
		{
			files: Array<string>;
			"base-directory"?: string;
			"discard-paths"?: CodeBuildBuildSpecStringBoolean;
			"file-format"?: "JUNITXML" | "JSON" | "HTML";
		}
	> = {};

	addReport(
		name: string,
		report: {
			files: Array<string>;
			"base-directory"?: string;
			"discard-paths"?: CodeBuildBuildSpecStringBoolean;
			"file-format"?: "JUNITXML" | "JSON" | "HTML";
		},
	) {
		this._reports[name] = report;
		return this;
	}

	setReports(
		reports: Record<
			string,
			{
				files: Array<string>;
				"base-directory"?: string;
				"discard-paths"?: CodeBuildBuildSpecStringBoolean;
				"file-format"?: "JUNITXML" | "JSON" | "HTML";
			}
		>,
	) {
		this._reports = reports;
		return this;
	}

	build(): CodeBuildBuildspecReports {
		return Object.fromEntries(
			Object.entries(this._reports).map(([key, value]) => {
				return [
					key,
					{
						files: value.files,
						"base-directory": value["base-directory"],
						"discard-paths": value["discard-paths"],
						"file-format": value["file-format"],
					},
				];
			}),
		);
	}
}

export type CodeBuildBuildspecArtifacts = CodeBuildBuildspec["artifacts"];

export class CodeBuildBuildspecArtifactsBuilder {
	private _files: Array<string> = [];
	private _name: string;
	private _baseDirectory?: string;
	private _excludePaths?: Array<string>;
	private _enableSymlinks?: CodeBuildBuildSpecStringBoolean;
	private _s3Prefix?: string;

	constructor() {
		this._files = [];
		this._name = "";
	}

	setFiles(files: Array<string>) {
		this._files = files;
		return this;
	}

	addFile(file: string) {
		this._files.push(file);
		return this;
	}

	setName(name: string) {
		this._name = name;
		return this;
	}

	setBaseDirectory(baseDirectory: string) {
		this._baseDirectory = baseDirectory;
		return this;
	}

	setExcludePaths(excludePaths: Array<string>) {
		this._excludePaths = excludePaths;
		return this;
	}

	setEnableSymlinks(enableSymlinks: CodeBuildBuildSpecStringBoolean) {
		this._enableSymlinks = enableSymlinks;
		return this;
	}

	setS3Prefix(s3Prefix: string) {
		this._s3Prefix = s3Prefix;
		return this;
	}

	build(): CodeBuildBuildspecArtifacts {
		const files = this._files;
		const name = this._name;
		const baseDirectory = this._baseDirectory;
		const excludePaths = this._excludePaths;
		const enableSymlinks = this._enableSymlinks;
		const s3Prefix = this._s3Prefix;

		return {
			files,
			name,
			...(baseDirectory ? { "base-directory": baseDirectory } : {}),
			...(excludePaths ? { "exclude-paths": excludePaths } : {}),
			...(enableSymlinks ? { "enable-symlinks": enableSymlinks } : {}),
			...(s3Prefix ? { "s3-prefix": s3Prefix } : {}),
		};
	}
}

export type CodeBuildBuildspecEnv = CodeBuildBuildspec["env"];

export class CodeBuildBuildspecEnvBuilder {
	private _shell: NonNullable<CodeBuildBuildspecEnv>["shell"] = "bash";
	private _variables: Record<string, string> = {};
	private _parameterStore: Record<string, string> = {};
	private _secretsManager: Record<
		string,
		CodebuildBuildSpecSecretmanagerTemplateString
	> = {};
	private _exportedVariables: Array<string> = [];
	private _gitCredentialHelper: CodeBuildBuildSpecStringBoolean = "no";

	setShell(shell: NonNullable<CodeBuildBuildspecEnv>["shell"]) {
		this._shell = shell;
		return this;
	}

	setVariable(key: string, value: string) {
		this._variables[key] = value;
		return this;
	}

	setVariables(variables: Record<string, string>) {
		this._variables = variables;
		return this;
	}

	setParameterStore(parameterStore: Record<string, string>) {
		this._parameterStore = parameterStore;
		return this;
	}

	setSecretsManager(
		secretsManager: Record<
			string,
			CodebuildBuildSpecSecretmanagerTemplateString
		>,
	) {
		this._secretsManager = secretsManager;
		return this;
	}

	setExportedVariables(exportedVariables: Array<string>) {
		this._exportedVariables = exportedVariables;
		return this;
	}

	setGitCredentialHelper(gitCredentialHelper: CodeBuildBuildSpecStringBoolean) {
		this._gitCredentialHelper = gitCredentialHelper;
		return this;
	}

	build(): CodeBuildBuildspecEnv {
		const shell = this._shell;
		const variables = this._variables;
		const parameterStore = this._parameterStore;
		const secretsManager = this._secretsManager;
		const exportedVariables = this._exportedVariables;
		const gitCredentialHelper = this._gitCredentialHelper;
		return {
			...(shell ? { shell } : {}),
			...(Object.keys(variables).length ? { variables } : {}),
			...(Object.keys(parameterStore).length
				? { "parameter-store": parameterStore }
				: {}),
			...(Object.keys(secretsManager).length
				? { "secrets-manager": secretsManager }
				: {}),
			...(exportedVariables.length
				? { "exported-variables": exportedVariables }
				: {}),
			...(gitCredentialHelper
				? { "git-credential-helper": gitCredentialHelper }
				: {}),
		};
	}
}

export type CodeBuildBuildspecResourceLambdaPhase =
	CodeBuildBuildspecResourceLambdaPhaseSpec;

export class CodeBuildBuildspecResourceLambdaPhaseBuilder {
	private _onFailure?: CodeBuildBuildspecResourceLambdaPhase["on-failure"];
	private _commands: Array<string> = [];
	private _finally: Array<string> = [];

	setOnFailure(onFailure: CodeBuildBuildspecResourceLambdaPhase["on-failure"]) {
		this._onFailure = onFailure;
		return this;
	}

	addCommand(command: string) {
		this._commands.push(command);
		return this;
	}

	setCommands(commands: Array<string>) {
		this._commands = commands;
		return this;
	}

	addFinally(command: string) {
		this._finally.push(command);
		return this;
	}

	setFinally(finallyCommands: Array<string>) {
		this._finally = finallyCommands;
		return this;
	}

	build(): CodeBuildBuildspecResourceLambdaPhase {
		const onFailure = this._onFailure;
		const commands = this._commands;
		const finallyCommands = this._finally;

		if (!commands.length) {
			throw new VError("At least one command is required");
		}

		return {
			...(onFailure ? { "on-failure": onFailure } : {}),
			commands,
			...(finallyCommands.length ? { finally: finallyCommands } : {}),
		};
	}
}

export class CodeBuildBuildspecBuilder {
	private _version: CodeBuildBuildspecVersion;
	private _proxy?: CodebuildBuildSpecProxyBuilder;
	private _batch?: CodeBuildBuildspecBatchBuilder;
	private _cache?: CodeBuildBuildspecCacheBuilder;
	private _reports?: CodeBuildBuildspecReportsBuilder;
	private _artifacts?: CodeBuildBuildspecArtifactsBuilder;
	private _env?: CodeBuildBuildspecEnvBuilder;
	private phases: {
		install?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
		pre_build?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
		build?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
		post_build?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
	} = {};

	constructor() {
		this._version = 0.2;
	}

	setVersion(version: CodeBuildBuildspecVersion) {
		this._version = version;
		return this;
	}

	setProxy(proxy: CodebuildBuildSpecProxyBuilder) {
		this._proxy = proxy;
		return this;
	}

	setBatch(batch: CodeBuildBuildspecBatchBuilder) {
		this._batch = batch;
		return this;
	}

	setCache(cache: CodeBuildBuildspecCacheBuilder) {
		this._cache = cache;
		return this;
	}

	setReports(reports: CodeBuildBuildspecReportsBuilder) {
		this._reports = reports;
		return this;
	}

	setArtifacts(artifacts: CodeBuildBuildspecArtifactsBuilder) {
		this._artifacts = artifacts;
		return this;
	}

	setEnv(env: CodeBuildBuildspecEnvBuilder) {
		this._env = env;
		return this;
	}

	setInstall(install: CodeBuildBuildspecResourceLambdaPhaseBuilder) {
		this.phases.install = install;
		return this;
	}

	setPreBuild(preBuild: CodeBuildBuildspecResourceLambdaPhaseBuilder) {
		this.phases.pre_build = preBuild;
		return this;
	}

	setBuild(build: CodeBuildBuildspecResourceLambdaPhaseBuilder) {
		this.phases.build = build;
		return this;
	}

	setPostBuild(postBuild: CodeBuildBuildspecResourceLambdaPhaseBuilder) {
		this.phases.post_build = postBuild;
		return this;
	}

	setPhases(phases: {
		install?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
		pre_build?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
		build?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
		post_build?: CodeBuildBuildspecResourceLambdaPhaseBuilder;
	}) {
		if (phases.install) {
			this.phases.install = phases.install;
		}
		if (phases.pre_build) {
			this.phases.pre_build = phases.pre_build;
		}
		if (phases.build) {
			this.phases.build = phases.build;
		}
		if (phases.post_build) {
			this.phases.post_build = phases.post_build;
		}
		return this;
	}

	build(): CodeBuildBuildspec {
		const proxy = this._proxy?.build();
		const batch = this._batch?.build();
		const cache = this._cache?.build();
		const reports = this._reports?.build();
		const artifacts = this._artifacts?.build();
		const env = this._env?.build();
		const install = this.phases.install?.build();
		const pre_build = this.phases.pre_build?.build();
		const build = this.phases.build?.build();
		const post_build = this.phases.post_build?.build();

		if (!this._version) {
			throw new VError("Version is required");
		}

		if (!install && !pre_build && !build && !post_build) {
			throw new VError("At least one phase is required");
		}

		return {
			version: this._version,
			...(proxy ? { proxy } : {}),
			...(batch ? { batch } : {}),
			...(cache ? { cache } : {}),
			...(reports ? { reports } : {}),
			...(artifacts ? { artifacts } : {}),
			...(env ? { env } : {}),
			phases: {
				...(install ? { install } : {}),
				...(pre_build ? { pre_build } : {}),
				...(build ? { build } : {}),
				...(post_build ? { post_build } : {}),
			},
		};
	}
}
