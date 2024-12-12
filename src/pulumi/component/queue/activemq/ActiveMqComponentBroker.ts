import type { Output } from "@pulumi/pulumi/index.js";

export type ActiveMqBrokerSpec = {
	addressSettings: {
		addressSetting: {
			match: string;
			defaultAddressRoutingType: "ANYCAST" | "MULTICAST";
			autoCreateAddresses?: boolean;
			autoCreateQueues?: boolean;
		}[];
		applyRule: "merge_all" | "merge_replace" | "replace_all";
	};
	deploymentPlan: {
		size: number;
	};
	acceptors: {
		name: string;
		port: number;
		protocols: string;
	}[];
};

export interface ActiveMqBrokerSpecProps {
	numberOfInstances?: number;
	hostnames?: string[];
}

export class LeafActiveMqBrokerSpec {
	public static readonly ACCEPTOR_NAME = "leaf";
	public static readonly ACCEPTOR_PORT = 62626;
	static readonly activemq = () =>
		({
			// console: {
			//   expose: true,
			//   ingressHost: "activemq-console",
			// },
			addressSettings: {
				addressSetting: [
					{
						match: "#",
						defaultAddressRoutingType: "ANYCAST",
					},
				],
				applyRule: "merge_all",
			},
			deploymentPlan: {
				size: 1,
				// enableMetricsPlugin: true,
			},
			acceptors: [
				{
					name: LeafActiveMqBrokerSpec.ACCEPTOR_NAME,
					port: LeafActiveMqBrokerSpec.ACCEPTOR_PORT,
					protocols: "CORE,STOMP",
					// bindToAllInterfaces: true
				},
			],
			// brokerProperties: [
			//   "metricsConfiguration.jvmGc=true",
			//   "metricsConfiguration.jvmMemory=true",
			//   "metricsConfiguration.jvmThread=true",
			// ]
		}) as const satisfies ActiveMqBrokerSpec;

	static propsToSpec = (props: ActiveMqBrokerSpecProps): ActiveMqBrokerSpec => {
		const { numberOfInstances } = props;

		const defaults = LeafActiveMqBrokerSpec.activemq();
		return {
			deploymentPlan: {
				size: numberOfInstances ?? defaults.deploymentPlan.size,
			},
			acceptors: [...defaults.acceptors],
			addressSettings: {
				addressSetting: [...defaults.addressSettings.addressSetting],
				applyRule: defaults.addressSettings.applyRule,
			},
		};
	};
}

export type ActiveMqBrokerServiceName = "hdls-svc" | `${string}-0-svc`;
export type ActiveMqBrokerService = {
	k8s: {
		namespace: Output<string>;
		name: Output<string>;
	};
	service: {
		name: Output<string>;
		port: Output<number>;
	};
	activemq: {
		name: Output<ActiveMqBrokerServiceName>;
	};
};

export type ActiveMqBrokerSecretName = "credentials-secret";
export type ActiveMqBrokerSecret = {
	k8s: {
		namespace: Output<string>;
		name: Output<string>;
	};
	secret: {
		name: Output<string>;
	};
	activemq: {
		name: Output<ActiveMqBrokerSecretName>;
		brokerName?: Output<string>;
	};
};
