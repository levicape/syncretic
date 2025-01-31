import { StackReference, getStack } from "@pulumi/pulumi";
import { VError } from "verror";
import type { SomeZodObject, z } from "zod";
import { JsonParseException } from "./Exception";

export const $stack$ = getStack().split(".").pop();

export const $ref = (stack: string) =>
	new StackReference(`organization/${stack}/${stack}.${$stack$}`);

export const $val = <Z extends z.AnyZodObject>(
	json: string,
	schema: Z,
): z.infer<Z> => {
	try {
		if (typeof json !== "string") {
			return schema.parse(json);
		}

		return schema.parse(JSON.parse(json));
	} catch (e) {
		throw new JsonParseException(e, json);
	}
};

type DereferenceConfig = Record<
	string,
	Record<string, { refs: Record<string, SomeZodObject> }>
>;

type DereferencedOutput<T extends DereferenceConfig> = {
	[R in keyof T]: {
		[S in keyof T[R]]: {
			[K in keyof T[R][S]["refs"]]: z.infer<T[R][S]["refs"][K]>;
		};
	};
};

export const deref = async <T extends DereferenceConfig>(
	config: T,
): Promise<DereferencedOutput<T>[string]> => {
	const dereferencedRoots = {} as DereferencedOutput<T>;

	if (Object.keys(config).length > 1) {
		throw new VError("Only one root key is allowed");
	}

	for (const rootKey in config) {
		const rootStacks = config[rootKey];
		const dereferencedStacks = {} as Record<string, Record<string, unknown>>;

		for (const stackName in rootStacks) {
			const stackConfig = rootStacks[stackName];
			const outputValues = {} as Record<string, unknown>;

			const ref = $ref(`${rootKey}-${stackName}`);

			for (const stackOutput in stackConfig.refs) {
				const schema = stackConfig.refs[stackOutput];
				const output = await ref.getOutputDetails(
					`${rootKey}_${stackName}_${stackOutput}`,
				);
				outputValues[stackOutput] = $val(output.value, schema);
			}

			dereferencedStacks[stackName] = outputValues;
		}

		dereferencedRoots[rootKey] =
			dereferencedStacks as DereferencedOutput<T>[typeof rootKey];
	}

	return Object.values(dereferencedRoots)[0];
};
