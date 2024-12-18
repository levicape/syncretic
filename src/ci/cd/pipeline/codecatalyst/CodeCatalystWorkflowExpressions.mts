import { PipelineStateGeneratorBuilder } from "../../state/PipelineStateGeneratorBuilder.mjs";

export const CodeCatalystPipelineStateGeneratorBuilderConfiguration = {
	template: {
		env: (val: string) => `\$${val}`,
		secret: (val: string) => `\${{ Secrets.${val} }}`,
	},
};

export const CodeCatalystWorkflowExpressions = (() => {
	let current = PipelineStateGeneratorBuilder(
		CodeCatalystPipelineStateGeneratorBuilderConfiguration,
	);
	return {
		current: {
			register: (key: string, value: string) => {
				let state = current.register.next([key, value]).value;
				if (state === "init") {
					let resolved = current.register.next([key, value]).value;
					if (typeof resolved === "object") {
						return {
							Name: key,
							Value: value,
						};
					}
				}
				throw new Error("Invalid state");
			},
			env: (val: string) => {
				if (current.env.next(val).value === "init") {
					let resolved = current.env.next(val).value;
					if (typeof resolved === "string") {
						return resolved;
					}
				}
				throw new Error("Invalid state");
			},
			secret: (val: string) => {
				if (current.secret.next(val).value === "init") {
					let resolved = current.secret.next(val).value;
					if (typeof resolved === "string") {
						return resolved;
					}
				}

				throw new Error("Invalid state");
			},
			context: (val: string) => `\${${val}}`,
		},
		reset: () => {
			current = PipelineStateGeneratorBuilder(
				CodeCatalystPipelineStateGeneratorBuilderConfiguration,
			);
		},
		getState: () => {
			return {
				registered: { ...current.maps.registered },
				env: { ...current.maps.env },
				secret: { ...current.maps.secret },
			} as const;
		},
	};
})();
