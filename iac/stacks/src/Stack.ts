import { StackReference, getStack } from "@pulumi/pulumi";
import type { z } from "zod";
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
