import VError from "verror";
import type { GithubStep } from "../github/GithubStepBuilder.mjs";
import type {
	CodeCatalystApprovalAction,
	CodeCatalystApprovalConfiguration,
	CodeCatalystApprovalProps,
} from "./actions/aws/CodeCatalystApprovalAction.mjs";
import type { CodeCatalystBuildAction } from "./actions/aws/CodeCatalystBuildAction.mjs";
import type { CodeCatalystTestAction } from "./actions/aws/CodeCatalystTestAction.mjs";

export type CodeCatalystConfigurationSpec<Configuration extends object> =
	Configuration;

export type CodeCatalystAction<
	Identifier extends string,
	With extends string,
	Configuration extends Partial<Record<With, unknown | undefined>>,
	Rest extends object,
> = {
	Identifier: Identifier;
	Configuration: CodeCatalystConfigurationSpec<Configuration>;
} & Rest;

export type CodeCatalystActionGroup<
	DependsOn extends string,
	Inputs extends
		| {
				Sources: string | "WorkflowSource"[];
				Artifacts: string[];
				Variables: {
					Name: string;
					Value: string;
				}[];
		  }
		| never,
	Outputs extends
		| {
				Artifacts: {
					Name: string;
					Files: string[];
				}[];
				Variables: string[];
		  }
		| never,
> = {
	Actions: Record<DependsOn, CodeCatalystActions<DependsOn, Inputs, Outputs>>;
};

export type CodeCatalystActions<
	DependsOn extends string,
	Input extends
		| {
				Sources: string | "WorkflowSource"[];
				Artifacts: string[];
				Variables: {
					Name: string;
					Value: string;
				}[];
		  }
		| never,
	Output extends
		| {
				Artifacts: {
					Name: string;
					Files: string[];
				}[];
				Variables: string[];
		  }
		| never,
> =
	| CodeCatalystApprovalAction<DependsOn>
	| CodeCatalystBuildAction<DependsOn, Input, Output>
	| CodeCatalystTestAction<DependsOn, Input, Output>
	| CodeCatalystActionGroup<DependsOn, Input, Output>;

export type CodeCatalystActionBuilderUnknown<DependsOn extends string> =
	CodeCatalystActionBuilder<
		string,
		DependsOn,
		string,
		Partial<Record<string, unknown>>,
		Partial<Record<string, unknown>>
	>;

const normalizeenvname = (envname: string) => {
	return envname.replaceAll("-", "_").toUpperCase();
};
let envregex = [
	/\${{ env.(.*?) }}/,
	(matches: string[]) => {
		return `$${normalizeenvname(matches[1])}`;
	},
] as const;

let hashfilesregex = [
	/\${{ hashFiles(.*) }}/,
	(matches: string[]) => {
		let step = `\${{ checksum ${matches[1]} }}`;
		step = step.replace(/^\$\{\{ checksum \(/, "${{ checksum ");
		step = step.replace(/\)\s*}}$/, " }}");

		return step;
	},
] as const;

export class CodeCatalystActionBuilder<
	Identifier extends string,
	DependsOn extends string,
	With extends string,
	Configuration extends Partial<Record<With, unknown | undefined>>,
	Rest extends object,
> {
	public static defaultRunsOn = () => "ubuntu-latest" as const;
	private children: CodeCatalystActionBuilderUnknown<DependsOn>[] = [];
	private configuration?: Configuration;
	private rest?: Rest;
	private needs: string[] = [];

	constructor(
		private identifier: Identifier,
		private id?: string,
	) {}

	getId(): string | undefined {
		return this.id;
	}

	setId(id: string): this {
		this.id = id;
		return this;
	}

	setIdentifier(identifier: Identifier): this {
		this.identifier = identifier;
		return this;
	}

	setConfiguration(configuration: Configuration): this {
		this.configuration = configuration;
		return this;
	}

	setRest(rest: Rest): this {
		this.rest = rest;
		return this;
	}

	addNeeds(needs: string[]): this {
		this.needs.push(...needs);
		return this;
	}

	includeWorkflowSource(): this {
		if (Object.hasOwn(this.rest ?? {}, "Inputs")) {
			let job = this.rest as unknown as {
				Inputs: {
					Sources?: string | "WorkflowSource"[];
				};
			};
			this.rest = {
				...this.rest,
				Inputs: {
					...(job.Inputs ?? {}),
					Sources: !(job.Inputs?.Sources ?? []).includes("WorkflowSource")
						? [...(job.Inputs?.Sources ?? []), "WorkflowSource"]
						: job?.Inputs.Sources,
				},
			} as typeof this.rest;
		}
		return this;
	}

	verifyPackagesConfiguration(scope?: string) {
		// Check existing PackagesRepository entries and match to step scope if specified
		if (scope) {
			if (Object.hasOwn(this.rest ?? {}, "Packages")) {
				const packages =
					(
						this.rest as {
							Packages: {
								NpmConfiguration?: {
									PackageRegistries?: {
										PackageRepository: string;
										Scopes?: string[];
									}[];
								};
							};
						}
					).Packages.NpmConfiguration ?? {};

				if (!packages.PackageRegistries) {
					packages.PackageRegistries = [];
				}

				const packageRegistry = packages.PackageRegistries.find((registry) =>
					registry.Scopes?.includes(scope ?? ""),
				);

				if (!packageRegistry) {
					throw new VError("No package registry found for scope %s", scope);
				}
			}
		}
	}

	cacheGithubAction(
		step: GithubStep<string, "path" | "key" | "restore-keys">,
	): this {
		if (Object.hasOwn(this.rest ?? {}, "Caching")) {
			const caching = (
				this.rest as {
					Caching: {
						FileCaching?: {
							[CacheName: string]: { RestoreKeys: string[]; Path: string };
						};
					};
				}
			).Caching;
			const cacheName = step.id;

			if (!caching?.FileCaching) {
				caching.FileCaching = {};
			}

			if (!cacheName) {
				throw new VError("Step id is required to use GHA cache: %s", step);
			}

			if (Object.keys(caching?.FileCaching ?? {}).length === 5) {
				throw new VError("Maximum number of caches reached");
			}

			if (!step.with) {
				throw new VError("Step with is required to use GHA cache: %s", step);
			}

			const restoreKeys = step.with["restore-keys"] ?? "";
			const path = step.with.path ?? "";

			if (Object.keys(caching?.FileCaching ?? {}).includes(cacheName)) {
				throw new VError("Cache with name %s already exists", cacheName);
			}

			caching.FileCaching[cacheName] = {
				RestoreKeys: [
					step.with.key!,
					...restoreKeys.split("\n").map((key) => {
						let k = key.trim();
						[envregex, hashfilesregex].forEach(([regex, replacer]) => {
							let matches = k.match(regex);
							if (matches) {
								matches.shift();
								matches.forEach((match) => {
									k = k.replace(regex, replacer([k, match]));
								});
							}
						});

						return k;
					}),
				],
				Path: path,
			};
		}
		return this;
	}

	normalizeWithEnv(step: GithubStep<string, string>): this {
		if (step.with) {
			let recursive = (withs: Record<string, string | undefined>) => {
				Object.entries(withs ?? {}).forEach(([key, value]) => {
					if (typeof value === "string") {
						[envregex, hashfilesregex].forEach(([regex, replacer]) => {
							let matches = value.match(new RegExp(regex, "g"));
							if (matches) {
								matches.forEach((match) => {
									let current = step.with![key];
									let exec = regex.exec(current ?? "");
									step.with![key] = current?.replace(
										regex,
										replacer(exec ?? []),
									);
								});
							}
						});
					}
					if (typeof value === "object") {
						recursive(value);
					}
				});
			};
			recursive(step.with);
		}

		return this;
	}

	copyWithReferencingEnvToInputs(step: GithubStep<string, string>): this {
		if (Object.hasOwn(this.rest ?? {}, "Inputs")) {
			const inputs = (
				this.rest as {
					Inputs: {
						Variables?: {
							Name: string;
							Value: string;
						}[];
					};
				}
			).Inputs;
			if (step.with) {
				if (!inputs.Variables) {
					inputs.Variables = [];
				}

				const withs = step.with ?? {};
				Object.entries(withs).forEach(([key, value]) => {
					if (typeof value === "string") {
						[envregex].forEach(([regex, replacer]) => {
							let matches = value.match(new RegExp(regex, "g"));
							if (matches) {
								matches.forEach((match) => {
									let current = step.with![key];
									let exec = regex.exec(current ?? "");

									console.dir(
										{
											CodeCatalystActionBuilder: {
												message: "Copying with to inputs",
												step: step,
												inputs: inputs,
												exec: exec,
											},
										},
										{ depth: null },
									);
									inputs.Variables!.push({
										Name: normalizeenvname(exec![1]),
										Value: replacer(["", "betty"])!,
									});
								});
							}
						});
					}
				});
			}
		}
		return this;
	}

	copyEnvsToInputs(step: GithubStep<string, string>): this {
		if (Object.hasOwn(this.rest ?? {}, "Inputs")) {
			const inputs = (
				this.rest as {
					Inputs: {
						Variables?: {
							Name: string;
							Value: string;
						}[];
					};
				}
			).Inputs;

			if (step.env) {
				if (!inputs.Variables) {
					inputs.Variables = [];
				}

				const envs = step.env ?? {};
				Object.entries(envs).forEach(([key, value]) => {
					inputs.Variables!.push({
						Name: normalizeenvname(key),
						Value: value!,
					});
				});
			}
		}
		return this;
	}

	normalizeInputSecrets(): this {
		if (Object.hasOwn(this.rest ?? {}, "Inputs")) {
			const inputs = (
				this.rest as {
					Inputs: {
						Variables?: {
							Name: string;
							Value: string;
						}[];
					};
				}
			).Inputs;
			if (inputs.Variables) {
				inputs.Variables = inputs.Variables.map((variable) => {
					if (variable.Value.startsWith("${{ secrets.")) {
						variable.Value = variable.Value.replace(
							"${{ secrets.",
							"${{ Secrets.",
						);
					}

					if (variable.Value.startsWith("${{ Secrets.GITHUB_TOKEN }}")) {
						console.dir({
							CodeCatalystActionBuilder: {
								message:
									"GITHUB_TOKEN secret will be transformed to $CATALYST_PACKAGES_AUTHORIZATION_TOKEN environment variable",
							},
						});
						variable.Value = "$CATALYST_PACKAGES_AUTHORIZATION_TOKEN";

						let packages = this.rest as {
							Packages?: {
								ExportAuthorizationToken?: boolean;
							};
						};
						if (!packages.Packages) {
							packages.Packages = {};
						}
						packages.Packages.ExportAuthorizationToken = true;
					}

					return variable;
				});
			}
		}
		return this;
	}

	deduplicateInputVariables(): this {
		if (Object.hasOwn(this.rest ?? {}, "Inputs")) {
			const inputs = (
				this.rest as {
					Inputs: {
						Variables?: {
							Name: string;
							Value: string;
						}[];
					};
				}
			).Inputs;
			if (inputs.Variables) {
				inputs.Variables = inputs.Variables.reduce(
					(acc, variable) => {
						if (!acc.find((v) => v.Name === variable.Name)) {
							acc.push(variable);
						} else {
							let existing = acc.find((v) => v.Name === variable.Name);
							if (existing?.Value !== variable.Value) {
								throw new VError(
									"Duplicate variable %s with different values for action %s",
									variable.Name,
									this.id,
								);
							}
						}
						return acc;
					},
					[] as typeof inputs.Variables,
				);
			}
		}
		return this;
	}

	build(): {
		job: CodeCatalystAction<Identifier, With, Configuration, Rest>;
		children: CodeCatalystActionBuilder<
			string,
			DependsOn,
			string,
			Partial<Record<string, unknown>>,
			Partial<Record<string, unknown>>
		>[];
	} {
		if (!this.identifier) {
			throw new Error("Job identifier is required");
		}

		if (!this.id) {
			throw new Error("Job id is required");
		}

		const Configuration = this.configuration ?? ({} as Configuration);
		const rest = this.rest ?? ({} as Rest);

		this.children.forEach((job) => {
			job.addNeeds([this.id!]);
		});

		if (this.identifier === "aws/approval@v1") {
			const { ApprovalsRequired } =
				Configuration as unknown as CodeCatalystApprovalConfiguration;
			if (!ApprovalsRequired) {
				throw new Error("ApprovalsRequired is required");
			}

			const props = rest as unknown as CodeCatalystApprovalProps<string>;
			this.needs.forEach((need) => {
				props.DependsOn.push(need);
			});
		}

		// if (DependsOn in Configuration) {
		// 	const dependsOn = Configuration[DependsOn] as string[];
		// 	dependsOn.push(...this.needs);
		// 	Configuration[DependsOn] = dependsOn;
		// }

		const caching = rest as unknown as {
			Caching: {
				FileCaching?: {
					[CacheName: string]: { RestoreKeys: string[]; Path: string };
				};
			};
		};
		if ("Caching" in caching) {
			if ("FileCaching" in caching) {
				const fileCaching = caching.FileCaching as Record<string, unknown>;
				if (Object.keys(fileCaching).length > 5) {
					throw new VError("Maximum number of caches reached");
				}
			}
		}

		let restwithoutUndefined: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(rest)) {
			if (value !== undefined) {
				if (typeof value === "object") {
					if (Object.keys(value).length > 0) {
						restwithoutUndefined[key] = value;
					}
				} else {
					restwithoutUndefined[key] = value;
				}
			}
		}

		return {
			job: {
				Identifier: this.identifier,
				...((Object.keys(restwithoutUndefined).length > 0
					? restwithoutUndefined
					: {}) as Rest),
				Configuration:
					Object.keys(Configuration).length > 0
						? Configuration
						: (undefined as unknown as Configuration),
			},
			children: this.children as CodeCatalystActionBuilder<
				string,
				DependsOn,
				string,
				Partial<Record<string, unknown>>,
				Partial<Record<string, unknown>>
			>[],
		};
	}
}

export type CodeCatalystActionGroupPart<
	Identifiers extends string,
	ParentDependsOn extends string,
	DependsOn extends string,
> = {
	$$kind: "group";
	$id: ParentDependsOn;
	actions: CodeCatalystActionBuilder<
		Identifiers,
		DependsOn | ParentDependsOn,
		string,
		Partial<Record<string, unknown>>,
		Partial<Record<string, unknown>>
	>[];
	dependsOn?: ParentDependsOn[];
};
