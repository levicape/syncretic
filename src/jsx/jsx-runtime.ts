export function jsx(
	type: Function,
	// biome-ignore lint/suspicious/noExplicitAny:
	config: { children?: any[] } & Record<string, any>,
) {
	if (typeof type === "function") {
		return type(config);
	}
	const { children = [], ...props } = config;
	// @ts-ignore
	const childrenProps: unknown[] = [].concat(children).filter((child) => {
		return child !== undefined && child !== null && child !== false;
	});

	return {
		type,
		props: {
			...props,
			children: childrenProps,
		},
	};
}

export const jsxs = jsx;

export function Fragment(
	// biome-ignore lint/suspicious/noExplicitAny:
	config: { children?: any[] } & Record<string, any>,
) {
	const { children = [] } = config;
	const childrenProps: unknown[] = []
		// @ts-ignore
		.concat(children)
		.filter((child) => {
			return child !== undefined && child !== null && child !== false;
		});

	if (childrenProps.some((child) => typeof child === "string")) {
		throw new Error(
			`Fragment cannot contain text nodes. Please verify the jsx fragment: \n${JSON.stringify(childrenProps, null, 2)}`,
		);
	}
	return childrenProps;
}
