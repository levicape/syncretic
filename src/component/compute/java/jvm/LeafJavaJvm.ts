export class LeafJavaJvm {
	static eventConsumer(enabled: boolean) {
		return {
			LEAF_APPLICATION_CONSUMER_ENABLED: enabled ? "true" : "false",
			LEAF_APPLICATION_EAGER_INIT: enabled ? "false" : "true",
		};
	}
}
