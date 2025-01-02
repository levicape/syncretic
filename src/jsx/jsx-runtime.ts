export function jsx<
	BuilderKind,
	Children,
	RenderProp,
	FunctionProp extends (props: RenderProp) => Children[] | Children,
	PropKeys extends string,
>(
	type: (config: Record<PropKeys, unknown>) => BuilderKind,
	config: { children?: Children[] } & Record<PropKeys, unknown>,
):
	| BuilderKind
	| {
			type: (config: Record<PropKeys, unknown>) => BuilderKind;
			props: Record<PropKeys, unknown | undefined> & {
				children: Children | Children[] | FunctionProp;
			};
	  } {
	if (typeof type === "function") {
		return type(config);
	}
	const { ...props } = config;
	let { children } = config;

	let childrenProps: Children[] = [];
	if (children !== undefined) {
		if (!Array.isArray(children)) {
			children = [children];
		}
		childrenProps = [...children].filter((child) => {
			return child !== undefined && child !== null && child !== false;
		});
	}

	return {
		type,
		props: {
			...props,
			children: childrenProps,
		} as Record<PropKeys, unknown | undefined> & {
			children: Children | Children[] | FunctionProp;
		},
	};
}

export const jsxs = jsx;

export function Fragment<Children, PropKeys extends string>(
	config: { children?: Children[] } & Record<PropKeys, unknown>,
): Children[] {
	const { children = [] } = config;
	const childrenProps: Children[] = (
		Array.isArray(children) ? [...children] : [children]
	).filter((child) => {
		return child !== undefined && child !== null && child !== false;
	});

	if (childrenProps.some((child) => typeof child === "string")) {
		throw new Error(
			`Fragment cannot contain text nodes. Please verify the jsx fragment: \n${JSON.stringify(childrenProps, null, 2)}`,
		);
	}
	return childrenProps;
}
