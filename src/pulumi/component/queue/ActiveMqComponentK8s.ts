import { ConfigGroup } from "@pulumi/kubernetes/yaml/v2/index.js";
import { type Input, Output, all } from "@pulumi/pulumi/output.js";
import {
	ComponentResource,
	type ComponentResourceOptions,
} from "@pulumi/pulumi/resource.js";
import { stringify } from "yaml";
import {
	type ActiveMqBrokerSecret,
	type ActiveMqBrokerSecretName,
	type ActiveMqBrokerService,
	type ActiveMqBrokerServiceName,
	type ActiveMqBrokerSpec,
	type ActiveMqBrokerSpecProps,
	LeafActiveMqBrokerSpec,
} from "./activemq/ActiveMqComponentBroker.js";
import type {
	ActiveMqAddressSpec,
	ActiveMqComponentQueueState,
} from "./activemq/ActiveMqComponentQueue.js";

export interface ActiveMqComponentK8sProps {
	k8sNamespace: Input<string>;
	broker: ActiveMqBrokerSpecProps;
}

export interface ActiveMqComponentK8sState {
	resource: {
		broker: ConfigGroup;
	};
	services: {
		primary: ActiveMqBrokerService;
		stomp: ActiveMqBrokerService;
	};
	secrets: {
		broker: Record<ActiveMqBrokerSecretName, ActiveMqBrokerSecret>;
	};
}

export class ActiveMqComponentK8s extends ComponentResource {
	static readonly URN = "queue:activemq-k8s::operator";

	readonly spec: {
		broker: ActiveMqBrokerSpec;
		address?: ActiveMqAddressSpec;
	};
	readonly k8s: ActiveMqComponentK8sState;
	readonly queue?: ActiveMqComponentQueueState;

	constructor(
		name: string,
		props: ActiveMqComponentK8sProps,
		opts?: ComponentResourceOptions,
	) {
		super(ActiveMqComponentK8s.URN, name, props, opts);
		this.spec = {
			broker: {
				...LeafActiveMqBrokerSpec.propsToSpec(props.broker),
			},
		};

		const brokerK8sResource = {
			apiVersion: "broker.amq.io/v1beta1",
			kind: "ActiveMQArtemis",
			spec: this.spec.broker,
		};

		this.k8s = (() => {
			const resourceName = name
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "--")
				.replace(/^-|-$/g, "");

			const broker = new ConfigGroup(
				`${name}-activemq`,
				{
					yaml: all([props.k8sNamespace]).apply(([namespace]) => {
						console.debug({
							ActiveMqComponentK8s: {
								namespace,
								spec: JSON.stringify(this.spec.broker),
							},
						});
						return stringify({
							metadata: {
								name: resourceName,
								namespace,
							},
							...brokerK8sResource,
						});
					}),
					skipAwait: false,
				},
				{ parent: this },
			);

			const service = (() => {
				return (serviceName?: ActiveMqBrokerServiceName) => {
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
								serviceName?.includes(LeafActiveMqBrokerSpec.ACCEPTOR_NAME)
									? LeafActiveMqBrokerSpec.ACCEPTOR_PORT
									: 61616,
							),
						},
						activemq: {
							name: Output.create(
								computedName,
							) as Output<ActiveMqBrokerServiceName>,
						},
					} satisfies ActiveMqBrokerService;
				};
			})();

			const user = (() => {
				return (secretType: "credentials" = "credentials") => {
					const suffix = "secret";
					const fullName = `${resourceName}-${secretType}-${suffix}`;
					return {
						k8s: {
							namespace: Output.create(props.k8sNamespace),
							name: Output.create(fullName),
						},
						secret: {
							name: Output.create(fullName),
						},
						activemq: {
							name: Output.create("credentials-secret"),
							brokerName: Output.create(`${resourceName}`),
						},
					} satisfies ActiveMqBrokerSecret;
				};
			})();

			return {
				resource: {
					broker,
				},
				services: {
					primary: service("hdls-svc"),
					stomp: service(`${LeafActiveMqBrokerSpec.ACCEPTOR_NAME}-0-svc`),
				},
				secrets: {
					broker: {
						"credentials-secret": user("credentials"),
					},
				},
			} satisfies ActiveMqComponentK8sState;
		})();

		this.registerOutputs({
			k8s: this.k8s,
			spec: this.spec,
		});
	}
}
