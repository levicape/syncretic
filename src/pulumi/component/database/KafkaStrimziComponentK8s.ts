import { Role } from "@pulumi/kubernetes/rbac/v1/role.js";
import { RoleBinding } from "@pulumi/kubernetes/rbac/v1/roleBinding.js";
import { ConfigGroup } from "@pulumi/kubernetes/yaml/v2/index.js";
import { type Input, Output, all } from "@pulumi/pulumi/output.js";
import {
	ComponentResource,
	type ComponentResourceOptions,
} from "@pulumi/pulumi/resource.js";
import { stringify } from "yaml";
import type { PostgresZalandoComponentK8s } from "./PostgresZalandoComponentK8s.js";

export type KafkaStrimziVersion = "3.7.1" | "3.8.0";
export type KafkaDebeziumPostgresVersion = "2.7.2";
export type KafkaStrimziSpec = {
	kafka: {
		version: KafkaStrimziVersion;
		replicas: number;
		listeners: Array<{
			name: string;
			port: number;
			type: "internal" | "cluster-ip" | "ingress" | "nodeport";
			tls: boolean;
		}>;
		storage: {
			type: "jbod" | "ephemeral" | "persistent-claim";
			volumes?: Array<{
				id: number;
				size: string;
				type: "persistent-claim";
				deleteClaim: boolean;
			}>;
		};
		config: Record<string, string> & {
			"auto.create.topics.enable"?: "true" | "false";
			"default.replication.factor": string;
			"offsets.topic.replication.factor": string;
			"config.storage.replication.factor": string;
			"offset.storage.replication.factor": string;
			"status.storage.replication.factor": string;
			"transaction.state.log.replication.factor": string;
			"transaction.state.log.min.isr": string;
			"min.insync.replicas": string;
			"inter.broker.protocol.version": string;
		};
	};
	zookeeper: {
		replicas: number;
		storage: {
			type: "jbod" | "ephemeral" | "persistent-claim";
			volumes?: Array<{
				id: number;
				size: string;
				type: "persistent-claim";
				deleteClaim: boolean;
			}>;
		};
	};
	entityOperator: {
		topicOperator: object;
		userOperator: object;
	};
};
export type KafkaStrimziConnectSpec = {
	version: KafkaStrimziVersion;
	replicas: number;
	bootstrapServers: string;
	config: Record<string, string> & {
		"group.id": string;
		"config.providers": string;
		"config.providers.secrets.class": "io.strimzi.kafka.KubernetesSecretConfigProvider";
		"offset.storage.topic": string;
		"config.storage.topic": string;
		"status.storage.topic": string;
		// # -1 means it will use the default replication factor configured in the broker
		"config.storage.replication.factor": "-1";
		"offset.storage.replication.factor": "-1";
		"status.storage.replication.factor": "-1";
	};
} & (
	| {
			build?: {
				output: {
					type: "docker";
					image: string;
					pushSecret?: string;
					additionalKanikoOptions?: Array<`--${
						| `customPlatform`
						| `insecure${`` | `-pull` | `-registry`}`
						| `log-${`format` | `timestamp`}`
						| `registry-mirror`
						| `reproducible`
						| `single-snapshot`
						| `skip-tls-verify${`` | `-pull` | `-registry`}`
						| `verbosity=${`debug` | `info` | `warn` | `error`}`
						| `snapshotMode=${`default` | `time` | `redo`}`
						| `use-new-run`
						| `no-push${`` | `-cache`}`}`>;
				};
				plugins: Array<{
					name: string;
					artifacts: Array<{
						type: "tgz";
						url: string;
					}>;
				}>;
			};
	  }
	| {
			image: string;
	  }
);

export type KafkaStrimziConnectorSpec = {
	class: string;
	tasksMax: number;
	config: Record<string, string> & {
		"tasks.max": string;
		"database.hostname": string;
		"database.port": string;
		"database.user": `${"${secrets:"}${string}:username}`;
		"database.password": `${"${secrets:"}${string}:password}`;
		"database.server.id": string;
		"database.dbname": string;
		"topic.prefix"?: string | "postgres";
		"schema.history.internal.kafka.bootstrap.servers": `${string}-kafka-bootstrap:${number}`;
		"schema.history.internal.kafka.topic": `schema-changes.${string}`;
	};
};
type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
		}
	: T;
export type KafkaStrimziSpecProps = DeepPartial<KafkaStrimziSpec>;

export class LeafKafkaStrimziSpec {
	static readonly INTERNAL_PLAIN = {
		name: "plain",
		port: 9092,
		type: "internal",
		tls: false,
	} as const;

	static readonly INTERNAL_TLS = {
		name: "tls",
		port: 9093,
		type: "internal",
		tls: true,
	} as const;

	static readonly CLUSTER_IP_PLAIN = {
		name: "plainip",
		port: 10092,
		type: "cluster-ip",
		tls: false,
	} as const;

	static readonly CLUSTER_IP_TLS = {
		name: "tlsip",
		port: 10093,
		type: "cluster-ip",
		tls: true,
	} as const;

	static readonly strimzi = (nodePort?: number) =>
		({
			kafka: {
				version: "3.8.0",
				replicas: 1,
				listeners: [
					LeafKafkaStrimziSpec.INTERNAL_PLAIN,
					LeafKafkaStrimziSpec.INTERNAL_TLS,
					LeafKafkaStrimziSpec.CLUSTER_IP_PLAIN,
					LeafKafkaStrimziSpec.CLUSTER_IP_TLS,
					...(nodePort !== undefined
						? [
								{
									name: "nodeport",
									port: nodePort!,
									type: "nodeport",
									tls: false,
								} as const,
							]
						: []),
					// TODO: Configure hostname & ingress controller
					// {
					//   name: "tlsingress",
					//   port: 30093,
					//   type: "ingress",
					//   tls: true,
					// },
				],
				storage: {
					type: "ephemeral",
				},
				config: {
					"default.replication.factor": "1",
					"config.storage.replication.factor": "3",
					"offset.storage.replication.factor": "3",
					"status.storage.replication.factor": "3",
					"offsets.topic.replication.factor": "1",
					"transaction.state.log.replication.factor": "1",
					"transaction.state.log.min.isr": "1",
					"min.insync.replicas": "1",
					"inter.broker.protocol.version": "3.4",
				},
			},
			zookeeper: {
				replicas: 3,
				storage: {
					type: "ephemeral",
				},
			},
			entityOperator: {
				topicOperator: {},
				userOperator: {},
			},
		}) as const satisfies KafkaStrimziSpec;

	static readonly connect = (
		prefix: string,
		{
			image,
			kafkaVersion,
			bootstrapService,
			bootstrapPort,
		}: {
			image: string;
			kafkaVersion: KafkaStrimziVersion;
			bootstrapService: `${string}-${KafkaStrimziServiceName}`;
			bootstrapPort: number;
		},
		{
			debeziumVersion,
		}: {
			debeziumVersion?: KafkaDebeziumPostgresVersion;
		} = {},
	) =>
		({
			version: "3.8.0",
			replicas: 1,
			image: debeziumVersion === undefined ? image : undefined,
			bootstrapServers: `${bootstrapService}:${bootstrapPort}`,
			config: {
				"group.id": `${prefix}-connect-cluster`,
				"config.providers": "secrets",
				"config.providers.secrets.class":
					"io.strimzi.kafka.KubernetesSecretConfigProvider",
				"offset.storage.topic": "connect-offsets",
				"config.storage.topic": "connect-configs",
				"status.storage.topic": "connect-status",
				"config.storage.replication.factor": "-1",
				"offset.storage.replication.factor": "-1",
				"status.storage.replication.factor": "-1",
			},
			build:
				debeziumVersion !== undefined
					? {
							output: {
								type: "docker",
								image: `${image}/kafka-connect:${kafkaVersion}-${debeziumVersion}`,
								additionalKanikoOptions: [
									"--insecure",
									"--insecure-pull",
									"--insecure-registry",
									"--skip-tls-verify",
									"--skip-tls-verify-pull",
									"--skip-tls-verify-registry",
									"--reproducible",
									"--use-new-run",
									"--verbosity=debug",
								],
							},
							plugins: [
								...(debeziumVersion !== undefined
									? [
											{
												name: "debezium-postgres-connector",
												artifacts: [
													{
														type: "tgz",
														url: `https://repo1.maven.org/maven2/io/debezium/debezium-connector-postgres/${debeziumVersion}/debezium-connector-postgres-${debeziumVersion}-plugin.tar.gz`,
													} as const,
												],
											},
										]
									: []),
							],
						}
					: undefined,
		}) as const satisfies KafkaStrimziConnectSpec;

	static readonly connector = ({
		class: connectorClass,
		tasksMax,
		config,
	}: KafkaStrimziConnectorSpec) =>
		({
			class: connectorClass,
			tasksMax,
			config: {
				...config,
				"tasks.max": `${tasksMax}`,
			},
		}) as const satisfies KafkaStrimziConnectorSpec;

	static readonly connectorPostgres = ({
		tasksMax,
		config,
	}: Omit<KafkaStrimziConnectorSpec, "class">) =>
		LeafKafkaStrimziSpec.connector({
			class: "io.debezium.connector.postgresql.PostgresConnector",
			tasksMax,
			config: {
				...config,
				"tasks.max": `${tasksMax}`,
			},
		}) as KafkaStrimziConnectorSpec;
	static propsToSpec = ({
		kafkaStrimziSpec: database,
		nodePort,
	}: KafkaStrimziComponentK8sProps): KafkaStrimziSpec => {
		const defaults = LeafKafkaStrimziSpec.strimzi(nodePort);
		return {
			kafka: {
				...defaults.kafka,
				...database.kafka,
			},
			zookeeper: {
				...defaults.zookeeper,
				...database.zookeeper,
			},
			entityOperator: {
				...defaults.entityOperator,
				...database.entityOperator,
			},
		} as KafkaStrimziSpec;
	};
}

export type KafkaStrimziServiceName<
	T extends string = ReturnType<
		typeof LeafKafkaStrimziSpec.strimzi
	>["kafka"]["listeners"][number]["name"],
> =
	| `zookeeper-${`nodes` | `client`}`
	| `kafka-${`bootstrap` | `brokers`}`
	| `kafka-${T}-${`bootstrap` | `0`}`;

export type KafkaStrimziService = {
	k8s: {
		namespace: Output<string>;
		name: Output<string>;
	};
	service: {
		name: Output<string>;
		port: Output<number>;
	};
	strimzi: {
		name: Output<KafkaStrimziServiceName>;
	};
};
export type KafkaStrimziSecretGroupCluster = "cluster";
export type KafkaStrimziSecretGroupEntity = "entity-topic" | "entity-user";
export type KafkaStrimziSecretCaGroup =
	| "clients"
	| KafkaStrimziSecretGroupCluster;
export type KafkaStrimziSecretOperatorGroup =
	| KafkaStrimziSecretGroupEntity
	| KafkaStrimziSecretGroupCluster;
export type KafkaStrimziCaSecret = "ca-cert" | "ca";
export type KafkaStrimziSecretName =
	| `${KafkaStrimziSecretCaGroup}-${KafkaStrimziCaSecret}`
	| `${KafkaStrimziSecretOperatorGroup}-operator-certs`
	| `zookeeper-nodes`
	| `kafka-brokers`;

export type KafkaStrimziConfigMapGroupEntity = "entity-topic" | "entity-user";
export type KafkaStrimziConfigMapGroupConfig =
	| "zookeeper"
	| KafkaStrimziConfigMapGroupEntity;
export type KafkaStrimziConfigMapName =
	| "kafka-0"
	| `${KafkaStrimziConfigMapGroupConfig}-config`;

export interface KafkaStrimziComponentK8sState {
	resource: {
		kafka: ConfigGroup;
		connect: ConfigGroup;
		connector: {
			postgres: ConfigGroup;
		};
	};
	services: {
		bootstrap: KafkaStrimziService;
		broker: KafkaStrimziService;
	};
}

export interface KafkaStrimziComponentK8sProps {
	k8sNamespace: Input<string>;
	kafkaStrimziSpec: KafkaStrimziSpecProps;
	postgres: PostgresZalandoComponentK8s;
	repository?: {
		url: string;
	};
	nodePort?: number;
}

export class KafkaStrimziComponentK8s extends ComponentResource {
	static readonly URN = "database:kafka-k8s::strimzi";

	static micronaut = (enabled = "true") => ({
		MICRONAUT_APPLICATION_KAFKA_ENABLED: enabled,
	});

	static environmentVariables<T extends string>(
		prefix: T,
		kafkastream: KafkaStrimziComponentK8s,
		topic: string,
		clientId: string,
		groupId: string,
	): Output<Record<`${T}__${string}`, string>> {
		const namespace = kafkastream.k8s.services.bootstrap.k8s.namespace;
		return all([
			kafkastream.k8s.services.bootstrap.service.name,
			kafkastream.k8s.services.bootstrap.service.port,
			kafkastream.k8s.services.broker.service.name,
			kafkastream.k8s.services.broker.service.port,
			namespace,
		]).apply(
			([
				bootstrapServiceName,
				bootstrapServicePort,
				brokerServiceName,
				brokerServicePort,
				namespace,
			]) => {
				console.debug({
					KafkaStrimziComponentK8s: {},
				});

				const typechecked: Record<`${T}__${string}`, string> = {
					...(KafkaStrimziComponentK8s.micronaut() as unknown as Record<
						`${T}__${string}`,
						string
					>),
					[`${prefix}__NAME` as `${T}__${string}`]:
						topic.split(".").pop() ?? "UNKNOWN",
					[`${prefix}__REGION` as `${T}__${string}`]: namespace,
					[`${prefix}__BOOTSTRAP_URL` as `${T}__${string}`]: `${bootstrapServiceName}:${bootstrapServicePort}`,
					[`${prefix}__BROKER_URL` as `${T}__${string}`]: `${brokerServiceName}:${brokerServicePort}`,
					[`${prefix}__TOPIC` as `${T}__${string}`]: topic,
					[`${prefix}__CLIENT_ID` as `${T}__${string}`]: clientId,
					[`${prefix}__GROUP_ID` as `${T}__${string}`]: groupId,
				} as Record<`${T}__${string}`, string>;
				return typechecked as Record<`${T}__${string}`, string>;
			},
		);
	}

	// static envFrom<T extends string>(
	//   prefix: T,
	//   table: KafkaStrimziComponentK8s,
	// ): Output<Record<`${T}__${string}`, string>> {
	//   return all([table.k8s.resource.connect]).apply(([]) => {
	//     console.debug({
	//       KafkaStrimziComponentK8s: {},
	//     });

	//     const typechecked: Record<`${T}__${string}`, string> = {
	//       [`${prefix}__CLIENT_ID` as `${T}__${string}`]: "",
	//       [`${prefix}__GROUP_ID` as `${T}__${string}`]: "",
	//     } as Record<`${T}__${string}`, string>;
	//     return typechecked as Record<`${T}__${string}`, string>;
	//   });
	// }

	spec: {
		kafka: KafkaStrimziSpec;
		connect: KafkaStrimziConnectSpec;
		connector: {
			postgres: KafkaStrimziConnectorSpec;
		};
	};
	readonly k8s: KafkaStrimziComponentK8sState;
	static SERVER_ID = "777";

	constructor(
		name: string,
		props: KafkaStrimziComponentK8sProps,
		opts?: ComponentResourceOptions,
	) {
		super(KafkaStrimziComponentK8s.URN, name, props, opts);
		this.spec = {
			kafka: {
				...LeafKafkaStrimziSpec.propsToSpec(props),
			} satisfies KafkaStrimziSpec,
		} as KafkaStrimziComponentK8s["spec"];

		const k8sKafkaResource = {
			apiVersion: "kafka.strimzi.io/v1beta2",
			kind: "Kafka",
			spec: {
				...this.spec.kafka,
			},
		};

		this.k8s = (() => {
			const resourceName = name
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "--")
				.replace(/^-|-$/g, "");
			const connectName = `${resourceName}-dbz`;

			new Role(
				`${name}-strimzi-configuration-role`,
				{
					metadata: {
						name: `${resourceName}-configuration`,
						namespace: props.k8sNamespace,
					},
					rules: [
						all([
							props.postgres.k8s.secrets.database["fes-user"].secret.name,
						]).apply(([postgresSecretName]) => {
							return {
								apiGroups: [""],
								resources: ["secrets"],
								resourceNames: [postgresSecretName],
								verbs: ["get"],
							};
						}),
					],
				},
				{ parent: this },
			);

			const roleBinding = new RoleBinding(
				`${name}-strimzi-configuration-role-binding`,
				{
					metadata: {
						name: `${resourceName}-configuration-role-binding`,
						namespace: props.k8sNamespace,
					},
					roleRef: {
						name: `${resourceName}-configuration`,
						apiGroup: "rbac.authorization.k8s.io",
						kind: "Role",
					},
					subjects: [
						{
							kind: "ServiceAccount",
							name: `${connectName}-connect`,
						},
					],
				},
				{ parent: this },
			);

			const kafkaResource = new ConfigGroup(
				`${name}-strimzi`,
				{
					yaml: all([props.k8sNamespace]).apply(([namespace]) => {
						console.debug({
							KafkaStrimziComponentK8s: {
								namespace,
								kafka: JSON.stringify(this.spec.kafka),
							},
						});
						return stringify({
							metadata: {
								name: resourceName,
								namespace,
							},
							...k8sKafkaResource,
						});
					}),
					skipAwait: false,
				},
				{ parent: this },
			);

			this.spec = {
				...this.spec,
				connect: LeafKafkaStrimziSpec.connect(
					name,
					{
						image: `ytkenghong/debezium-connect-postgres:latest`,
						kafkaVersion: this.spec.kafka.kafka.version,
						bootstrapService: `${resourceName}-kafka-bootstrap`,
						bootstrapPort: LeafKafkaStrimziSpec.INTERNAL_PLAIN.port,
					},
					{},
				) as KafkaStrimziConnectSpec,
			};

			const kafkaConnectResource = new ConfigGroup(
				`${name}-strimzi-connect`,
				{
					yaml: all([props.k8sNamespace]).apply(([namespace]) => {
						const k8sKafkaConnectResource = {
							apiVersion: "kafka.strimzi.io/v1beta2",
							kind: "KafkaConnect",
							spec: {
								...this.spec.connect,
							},
						};
						console.debug({
							KafkaStrimziComponentK8s: {
								namespace,
								kafkaConnect: JSON.stringify(this.spec.connect),
							},
						});
						return stringify({
							metadata: {
								name: connectName,
								namespace,
								annotations: {
									"strimzi.io/use-connector-resources": "true",
								},
							},
							...k8sKafkaConnectResource,
						});
					}),
					skipAwait: false,
				},
				{ parent: this },
			);

			const connectorPostgresName = `${resourceName}-connector-postgres`;
			const kafkaPostgresResource = new ConfigGroup(
				`${name}-strimzi-connector-postgres`,
				{
					yaml: all([
						props.k8sNamespace,
						props.postgres.k8s.secrets.database["fes-user"].secret.name,
						props.postgres.k8s.services.master.service.name,
						props.postgres.k8s.services.master.service.port,
					]).apply(([namespace, secretName, hostname, port]) => {
						const dbName = Object.keys(props.postgres.k8s.secrets.prepared)[0];
						this.spec = {
							...this.spec,
							connector: {
								...(this.spec.connector ?? {}),
								postgres: LeafKafkaStrimziSpec.connectorPostgres({
									tasksMax: 1,
									config: {
										"tasks.max": "1",
										"database.hostname": hostname,
										"database.port": port.toString(),
										"database.user": `${"${"}secrets:${secretName}:username}`,
										"database.password": `${"${"}secrets:${secretName}:password}`,
										"database.server.id": KafkaStrimziComponentK8s.SERVER_ID,
										"database.server.name": "leaf_postgres_dbz",
										"database.dbname": `${dbName}`,
										"topic.prefix": connectorPostgresName,
										"schema.history.internal.kafka.bootstrap.servers": `${resourceName}-kafka-bootstrap:${LeafKafkaStrimziSpec.INTERNAL_PLAIN.port}`,
										"schema.history.internal.kafka.topic": `schema-changes.${dbName}`,
									},
								}),
							},
						};

						console.debug({
							KafkaStrimziComponentK8s: {
								namespace,
								kafkaPostgres: JSON.stringify(this.spec.connector.postgres),
							},
						});

						const k8sKafkaPostgresResource = {
							apiVersion: "kafka.strimzi.io/v1beta2",
							kind: "KafkaConnector",
							spec: {
								...this.spec.connector.postgres,
							},
						};
						return stringify({
							metadata: {
								name: connectorPostgresName,
								namespace,
								labels: {
									"strimzi.io/cluster": `${connectName}`,
								},
							},
							...k8sKafkaPostgresResource,
						});
					}),
					skipAwait: false,
				},
				{ parent: this, dependsOn: [roleBinding] },
			);

			const service = (() => {
				return (serviceName?: KafkaStrimziServiceName) => {
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
							port: Output.create(
								serviceName === "kafka-bootstrap" ? 9092 : 10092,
							),
						},
						strimzi: {
							name: Output.create(
								computedName,
							) as Output<KafkaStrimziServiceName>,
						},
					} satisfies KafkaStrimziService;
				};
			})();

			return {
				resource: {
					kafka: kafkaResource,
					connect: kafkaConnectResource,
					connector: {
						postgres: kafkaPostgresResource,
					},
				},
				services: {
					bootstrap: service("kafka-bootstrap"),
					broker: service("kafka-plainip-0"),
				},
				// kubectl run -n leaf-jam-k8sdev-k8s -it --rm --image=quay.io/debezium/tooling:1.2  --restart=Never watcher -- kcat -b leaf-jam-k8sdev--k8s-stream-kafka-bootstrap:9092 -C -o beginning -t leaf-jam-k8sdev--k8s-stream-connector-postgres.public.tarrasq_dispatch
			} satisfies KafkaStrimziComponentK8sState;
		})();

		this.registerOutputs({
			k8s: this.k8s,
			spec: this.spec,
		});
	}
}
