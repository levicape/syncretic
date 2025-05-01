import { inspect } from "node:util";
import { StackReference, getStack, log } from "@pulumi/pulumi";
import { destr } from "destr";
import { serializeError } from "serialize-error";
import { VError } from "verror";
import type { z } from "zod";
import { objectEntries, objectFromEntries } from "./Object";

export const $stack$ = getStack().split(".").pop();

const $$refpath = (stack: string) =>
	`organization/${stack}/${stack}.${$stack$}`;

export const $ref = (stack: string) => new StackReference($$refpath(stack));

export const $val = <Z extends z.AnyZodObject | z.ZodRecord>(
	json: string,
	schema: Z,
	opts?: {
		info?: Record<string, unknown>;
	},
): z.infer<Z> => {
	try {
		if (typeof json !== "string") {
			return schema.parse(json);
		}

		return schema.parse(destr(json));
	} catch (e: unknown) {
		const info = {
			...(opts?.info ?? {}),
			SchemaObject: schema?.toString(),
			JsonAttemptedToParse: json,
		};
		log.error(
			inspect(
				{
					$deref: {
						error: "StackRefValueParseError",
						info,
					},
				},
				{ depth: null },
			),
		);

		throw new VError(
			{
				name: "StackrefValueParseError",
				message: `Failed to parse value`,
				info: {
					SerializedError: serializeError(e),
				},
			},
			`Failed to parse '${opts?.info?.["OutputName"] ?? "<OUTPUT_NAME>"}' value`,
		);
	}
};

export type DereferenceConfig = Record<
	string,
	Record<string, { refs: Record<string, z.AnyZodObject | z.ZodRecord> }>
>;

export type DereferencedOutput<T extends DereferenceConfig> = {
	[R in keyof T]: {
		[S in keyof T[R]]: {
			[K in keyof T[R][S]["refs"]]: z.infer<T[R][S]["refs"][K]>;
		};
	};
};

export const $deref = async <T extends DereferenceConfig>(
	config: T,
): Promise<DereferencedOutput<T>[string]> => {
	const dereferencedRoots = {} as DereferencedOutput<T>;

	log.debug(
		inspect(
			{
				$deref: {
					config,
				},
			},
			{ depth: null },
		),
	);

	if (Object.keys(config).length > 1) {
		throw new VError("Only one root key is allowed");
	}

	for (const rootKey in config) {
		const rootStacks = config[rootKey];
		const dereferencedStacks = {} as Record<string, Record<string, unknown>>;

		for (const stackName in rootStacks) {
			const stackConfig = rootStacks[stackName];
			const outputValues = {} as Record<string, unknown>;

			const stackRefKey = `${rootKey}-${stackName}`;
			const ref = $ref(stackRefKey);
			for (const stackOutput in stackConfig.refs) {
				const schema = stackConfig.refs[stackOutput];
				const envStackName = stackName.replace(/-/g, "_");
				const outputName = `${rootKey}_${envStackName}_${stackOutput}`;
				log.info(
					inspect(
						{
							$deref: {
								$$ref: stackRefKey,
								$$refpath: $$refpath(stackRefKey),
								output: {
									stackName,
									outputName,
								},
							},
						},
						{ depth: null },
					),
				);
				const output = await ref.getOutputDetails(outputName);
				outputValues[stackOutput] = $val(output.value, schema, {
					info: {
						RootKey: rootKey,
						EnvStackName: envStackName,
						StackOutput: stackOutput,
						OutputName: outputName,
					},
				});
			}

			dereferencedStacks[stackName] = outputValues;
		}

		dereferencedRoots[rootKey] =
			dereferencedStacks as DereferencedOutput<T>[typeof rootKey];
	}
	log.info(
		inspect(
			{
				$deref: {
					$stack$,
					stack: getStack(),
					dereferenced: dereferencedRoots,
				},
			},
			{ depth: null },
		),
	);

	return Object.values(dereferencedRoots)[0];
};

export const $$root = <StackExports extends Record<string, unknown>>(
	exportedRoot: string,
	stackrefRoot: string,
	references: StackExports,
): StackExports => {
	return objectFromEntries(
		objectEntries(references).map(([key, value]) => {
			const relativeKey = (key as string).replace(
				new RegExp(`^${exportedRoot}`),
				stackrefRoot,
			);
			return [relativeKey, value];
		}),
	) as StackExports;
};
