import { execSync } from "node:child_process";
import {
	type Ipostgresql,
	postgresql,
} from "@kubernetes-models/postgres-operator/acid.zalan.do/v1/index";
import { ConfigGroup } from "@pulumi/kubernetes/yaml/v2/index.js";
import { type Input, Output, all } from "@pulumi/pulumi/output.js";
import {
	ComponentResource,
	type ComponentResourceOptions,
} from "@pulumi/pulumi/resource.js";
import { stringify } from "yaml";
import { KafkaStrimziComponentK8s } from "./KafkaStrimziComponentK8s.js";
import { createDatabaseEnvironment } from "./PostgresZalandoComponentK8s.context.js";

export type PostgresZalandoVersion = "12" | "13" | "14" | "15" | "16";
export type PostgresZalandoSpec = Ipostgresql["spec"];
export type PostgresZalandoUserRoles = NonNullable<
	Ipostgresql["spec"]["users"]
>[number][number];

export interface PostgresZalandoSpecProps<
	PreparedDatabaseName extends string = keyof ReturnType<
		typeof LeafPostgresZalandoSpec.zalando
	>["preparedDatabases"],
> {
	teamId: string;
	users?: Record<string, PostgresZalandoUserRoles[]>;
	numberOfInstances?: number;
	dockerImage?: string;
	enableMasterLoadBalancer?: boolean;
	enableReplicaLoadBalancer?: boolean;
	enableConnectionPooler?: boolean;
	allowedSourceRanges?: string[];
	databases?: Record<string, string>;
	preparedDatabases?: Record<
		PreparedDatabaseName,
		{
			defaultUsers: boolean;
			extensions: Record<string, string>;
			schemas: Record<
				"data" | string,
				Record<
					string,
					{
						defaultRoles?: boolean;
						defaultUsers?: boolean;
					}
				>
			>;
			secretNamespace?: string;
		}
	>;
	postgresql?: {
		version: PostgresZalandoVersion;
		parameters: Record<string, string>;
	};
	volume?: { size: string };
	additionalVolumes?: {
		name: string;
		mountPath: string;
		targetContainers: string[];
		volumeSource: { emptyDir: {} };
	}[];
	enableShmVolume?: boolean;
	resources?: {
		requests: { cpu: string; memory: string };
		limits: { cpu: string; memory: string };
	};
	tableNames?: string[];
}

export interface PostgresZalandoComponentK8sProps<
	PreparedDatabaseName extends string = keyof ReturnType<
		typeof LeafPostgresZalandoSpec.zalando
	>["preparedDatabases"],
> {
	k8sNamespace: Input<string>;
	database: PostgresZalandoSpecProps<PreparedDatabaseName>;
	migrations?: {
		executor: "psql" | "flyway";
		path: string;
	};
}

export class LeafPostgresZalandoSpec {
	public static readonly DEFAULT_SCHEMA = "public";
	static readonly zalando = (tableNames: string[] = []) =>
		({
			dockerImage: "ghcr.io/zalando/spilo-16:3.3-p1",
			teamId: "leaf__default",
			numberOfInstances: 2,
			users: {
				atoko_leaf: ["superuser", "createdb"],
				leaf_default_prepared_owner: ["superuser", "createdb"],
				fes_user: ["superuser", "createdb", "login", "replication"],
			},
			databases: {
				leaf_default_database: "atoko_leaf",
				leaf_default_prepared: "leaf_default_prepared_owner",
			},
			enableMasterLoadBalancer: false,
			enableReplicaLoadBalancer: false,
			enableConnectionPooler: false,
			allowedSourceRanges: ["127.0.0.1/32"],
			preparedDatabases: {
				leaf_default_prepared: {
					defaultUsers: true,
					extensions: {
						// pg_partman: "public",
						pgcrypto: "public",
					},
					schemas: {
						[LeafPostgresZalandoSpec.DEFAULT_SCHEMA]: {},
						history: {
							defaultRoles: true,
							defaultUsers: false,
						},
					},
				},
			},
			postgresql: {
				version: "16",
				parameters: {
					shared_buffers: "64MB",
					max_connections: "128",
					log_statement: "all",
				},
			},
			volume: {
				size: "1Gi", //"2Gi",
			},
			additionalVolumes: [
				// {
				//     name: "empty",
				//     mountPath: "/opt/empty",
				//     targetContainers: ["all"],
				//     volumeSource: {
				//         emptyDir: {}
				//     }
				// }
			],
			enableShmVolume: true,
			resources: {
				requests: {
					cpu: "10m",
					memory: "100Mi",
				},
				limits: {
					cpu: "500m",
					memory: "500Mi",
				},
			},
			streams:
				tableNames.length > 0
					? [
							{
								applicationId: KafkaStrimziComponentK8s.SERVER_ID,
								database: "leaf_default_prepared",
								batchSize: 10,
								tables: {
									...Object.fromEntries(
										tableNames.map((tableName) => [
											`${LeafPostgresZalandoSpec.DEFAULT_SCHEMA}.${tableName}`,
											{
												eventType: "INSERT",
												idColumn: "pk",
												payloadColumn: "jsondata",
											},
										]),
									),
								},
							},
						]
					: undefined,
		}) as const satisfies PostgresZalandoSpec;
	static propsToSpec = <
		PreparedDatabaseName extends string = keyof ReturnType<
			typeof LeafPostgresZalandoSpec.zalando
		>["preparedDatabases"],
	>(
		props: PostgresZalandoSpecProps<PreparedDatabaseName>,
	): PostgresZalandoSpec => {
		const {
			dockerImage,
			teamId,
			numberOfInstances,
			users,
			enableMasterLoadBalancer,
			enableReplicaLoadBalancer,
			enableConnectionPooler,
			allowedSourceRanges,
			databases,
			preparedDatabases,
			postgresql,
			volume,
			additionalVolumes,
			enableShmVolume,
			resources,
			tableNames,
		} = props;

		const defaults = LeafPostgresZalandoSpec.zalando(tableNames);
		return {
			dockerImage: dockerImage ?? defaults.dockerImage,
			teamId,
			numberOfInstances: numberOfInstances ?? defaults.numberOfInstances,
			users: {
				...defaults.users,
				...(users ?? {}),
			},
			enableMasterLoadBalancer:
				enableMasterLoadBalancer ?? defaults.enableMasterLoadBalancer,
			enableReplicaLoadBalancer:
				enableReplicaLoadBalancer ?? defaults.enableReplicaLoadBalancer,
			enableConnectionPooler:
				enableConnectionPooler ?? defaults.enableConnectionPooler,
			allowedSourceRanges: allowedSourceRanges ?? defaults.allowedSourceRanges,
			databases: databases ?? defaults.databases,
			preparedDatabases: preparedDatabases ?? defaults.preparedDatabases,
			postgresql: postgresql ?? defaults.postgresql,
			volume: volume ?? defaults.volume,
			additionalVolumes: additionalVolumes ?? defaults.additionalVolumes,
			enableShmVolume: enableShmVolume ?? defaults.enableShmVolume,
			resources: resources ?? defaults.resources,
			streams: defaults.streams,
		};
	};
}

export type PostgresZalandoServiceName = "" | "repl";
export type PostgresZalandoService = {
	k8s: {
		namespace: Output<string>;
		name: Output<string>;
	};
	service: {
		name: Output<string>;
		port: Output<number>;
	};
	zalando: {
		name: Output<PostgresZalandoServiceName>;
	};
};

export type PostgresZalandoUserSecretName = "postgres" | "standby" | "fes-user";
export type PostgresZalandoUserSecret = {
	k8s: {
		namespace: Output<string>;
		name: Output<string>;
	};
	secret: {
		name: Output<string>;
	};
	zalando: {
		name: Output<PostgresZalandoUserSecretName>;
		databaseName?: Output<string>;
	};
};

export interface PostgresZalandoComponentK8sState<
	PreparedDatabaseName extends string = keyof ReturnType<
		typeof LeafPostgresZalandoSpec.zalando
	>["preparedDatabases"],
> {
	resource: ConfigGroup;
	services: {
		master: PostgresZalandoService;
		replica: PostgresZalandoService;
	};
	secrets: {
		prepared: Record<
			PreparedDatabaseName,
			{
				owner: PostgresZalandoUserSecret;
				reader: PostgresZalandoUserSecret;
				writer: PostgresZalandoUserSecret;
				replication?: PostgresZalandoUserSecret;
			}
		>;
		database: Record<PostgresZalandoUserSecretName, PostgresZalandoUserSecret>;
	};
}

export class PostgresZalandoComponentK8s<
	PreparedDatabaseName extends string = keyof ReturnType<
		typeof LeafPostgresZalandoSpec.zalando
	>["preparedDatabases"],
> extends ComponentResource {
	static readonly URN = "database:postgres-k8s::zalando";

	readonly spec: PostgresZalandoSpec;
	readonly k8s: PostgresZalandoComponentK8sState<PreparedDatabaseName>;

	constructor(
		name: string,
		props: PostgresZalandoComponentK8sProps<PreparedDatabaseName>,
		opts?: ComponentResourceOptions,
	) {
		super(PostgresZalandoComponentK8s.URN, name, props, opts);
		this.spec = {
			...LeafPostgresZalandoSpec.propsToSpec<PreparedDatabaseName>(
				props.database,
			),
		};
		const k8sResource = {
			apiVersion: "acid.zalan.do/v1",
			kind: "postgresql",
			spec: this.spec,
		};
		const cluster = new postgresql(k8sResource);
		cluster.validate();

		this.k8s = (() => {
			const resourceName = name
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "--")
				.replace(/^-|-$/g, "");

			const resource = new ConfigGroup(
				`${name}-zalando`,
				{
					yaml: all([props.k8sNamespace]).apply(([namespace]) => {
						console.debug({
							PostgresZalandoComponentK8s: {
								namespace,
								spec: JSON.stringify(this.spec),
							},
						});
						return stringify({
							metadata: {
								name: resourceName,
								namespace,
							},
							...k8sResource,
						});
					}),
					skipAwait: false,
				},
				{ parent: this },
			);

			const service = (() => {
				return (serviceName?: PostgresZalandoServiceName) => {
					let computedName: string | undefined = serviceName;
					if (computedName === undefined) {
						computedName = `${resourceName}`;
					} else {
						computedName = `${resourceName}-${serviceName}`;
					}

					return {
						k8s: {
							namespace: Output.create(props.k8sNamespace),
							name: Output.create(computedName),
						},
						service: {
							name: Output.create(computedName),
							port: Output.create(5432),
						},
						zalando: {
							name: Output.create(
								computedName,
							) as Output<PostgresZalandoServiceName>,
						},
					};
				};
			})();

			const user = (() => {
				return (
					secretName: "postgres" | "standby" | "fes-user",
					secretType: "credentials" = "credentials",
				) => {
					const suffix = "postgresql.acid.zalan.do";
					const fullName = `${secretName}.${resourceName}.${secretType}.${suffix}`;
					return {
						k8s: {
							namespace: Output.create(props.k8sNamespace),
							name: Output.create(fullName),
						},
						secret: {
							name: Output.create(fullName),
						},
						zalando: {
							name: Output.create(secretName),
						},
					};
				};
			})();

			const preparedDatabaseRole = (databaseName: PreparedDatabaseName) => {
				return (
					secretName: "owner" | "reader" | "writer",
					secretType: "credentials" = "credentials",
				) => {
					const suffix = "postgresql.acid.zalan.do";
					const urlSafeDatabaseName = databaseName.replaceAll("_", "-");
					const fullName = `${urlSafeDatabaseName}-${secretName}-user.${resourceName}.${secretType}.${suffix}`;

					return {
						k8s: {
							namespace: Output.create(props.k8sNamespace),
							name: Output.create(fullName),
						},
						secret: {
							name: Output.create(fullName),
						},
						zalando: {
							name: Output.create(secretName),
							databaseName: Output.create(databaseName),
							urlSafeDatabaseName: Output.create(urlSafeDatabaseName),
						},
					};
				};
			};

			const prepared = (
				Object.keys(this.spec.preparedDatabases ?? {}) as PreparedDatabaseName[]
			).reduce((obj, database: PreparedDatabaseName) => {
				return {
					...obj,
					[database]: {
						owner: preparedDatabaseRole(database)("owner"),
						reader: preparedDatabaseRole(database)("reader"),
						writer: preparedDatabaseRole(database)("writer"),
					},
				};
			}, {}) as PostgresZalandoComponentK8sState<PreparedDatabaseName>["secrets"]["prepared"];

			if (props.migrations !== undefined) {
				execSync(`ls -1 ${props.migrations.path}`, {
					encoding: "ascii",
				})
					.toString()
					.split("\n");
				console.debug({
					PostgresZalandoComponentK8s: {
						migrations: props.migrations,
					},
				});
				// const migrations = paths.map((path) => {
				//   if (props.migrations!.executor === "flyway") {
				//     return new Command(
				//       `${name}-migrations`,
				//       {
				//         create: [
				//           "run",
				//           "--rm",
				//           "-v",
				//           `${props.migrations!.path}:/flyway/sql`,
				//           "your-docker-repo/flyway-migrations:latest",
				//         ].join(" "),
				//       },
				//       { parent: resource },
				//     );
				//   } else if (props.migrations!.executor === "psql") {
				//     return new Command(
				//       `${name}-migrations`,
				//       {
				//         create: [].join(" "),
				//         update: [].join(" "),
				//       },
				//       { parent: resource },
				//     );
				//   } else {
				//     throw new Error("Invalid executor");
				//   }
				// });
			}

			return {
				resource,
				// migrations,
				services: {
					master: service(),
					replica: service("repl"),
				},
				secrets: {
					prepared,
					database: {
						postgres: user("postgres"),
						standby: user("standby"),
						"fes-user": user("fes-user"),
					},
				},
			} satisfies PostgresZalandoComponentK8sState<PreparedDatabaseName>;
		})();

		this.registerOutputs({
			k8s: this.k8s,
			spec: this.spec,
		});
	}

	envs = (prefix: string) => {
		return createDatabaseEnvironment(this, prefix);
	};
}
