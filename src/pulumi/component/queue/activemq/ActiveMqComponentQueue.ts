export type ActiveMqComponentQueueProps = {
	addressName: string;
	queueName: string;
};

export type ActiveMqComponentQueueState = {
	addressName: string;
	queueName: string;
};

export type ActiveMqAddressSpec = {
	addressName: string;
	queueName: string;
	routingType: "anycast" | "multicast";
	removeFromBrokerOnDelete: boolean;
};

export interface ActiveMqAddressSpecProps {
	addressName: string;
	queueName: string;
	routingType?: "anycast" | "multicast";
	removeFromBrokerOnDelete?: boolean;
}

export class LeafActiveMqAddressSpec {
	static readonly activemq = () =>
		({
			addressName: "default",
			queueName: "default",
			routingType: "anycast",
			removeFromBrokerOnDelete: true,
		}) as const satisfies ActiveMqAddressSpec;

	static propsToSpec = (
		props: ActiveMqAddressSpecProps,
	): ActiveMqAddressSpec => {
		const { addressName, queueName, routingType, removeFromBrokerOnDelete } =
			props;

		const defaults = LeafActiveMqAddressSpec.activemq();
		return {
			addressName: addressName ?? defaults.addressName,
			queueName: queueName ?? defaults.queueName,
			routingType: routingType ?? defaults.routingType,
			removeFromBrokerOnDelete:
				removeFromBrokerOnDelete ?? defaults.removeFromBrokerOnDelete,
		};
	};
}
