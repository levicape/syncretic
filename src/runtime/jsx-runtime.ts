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
	const childrenProps: unknown[] = [].concat(children);
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
	// @ts-ignore
	const childrenProps: unknown[] = [].concat(children);
	if (childrenProps.some((child) => typeof child === "string")) {
		throw new Error("Fragment cannot contain text nodes");
	}
	return childrenProps;
}
