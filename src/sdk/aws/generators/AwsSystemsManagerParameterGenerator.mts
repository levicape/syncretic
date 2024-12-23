import VError from "verror";
import type { AwsSystemsManager } from "../clients/AwsSystemsManager.mjs";

export type AwsSystemsManagerParameterGeneratorProps = {
	root: AwsSystemsManager;
	systems?: AwsSystemsManager;
};

export type AwsSystemsManagerParameterGeneratorNext = {
	template: (principal?: string) => string;
	principal: string;
	default?: string | undefined;
};

export type AwsSystemsManagerParameterValue = {
	Parameter: {
		Name: string;
		Type: string;
		Value: string;
		Version: number;
		LastModifiedDate: number;
		ARN: string;
	};
};
export type AwsSystemsManagerParameterState = {
	isDefaulted: boolean;
	parameter: {
		root: {
			name: string;
			value: AwsSystemsManagerParameterValue | undefined;
		};
		scoped:
			| {
					name: string;
					value: AwsSystemsManagerParameterValue | undefined;
			  }
			| undefined;
	};
	update: (value: string) => Promise<{
		$$kind: string;
		parameter: {
			root: {
				name: string;
				value:
					| {
							Version: number;
					  }
					| undefined;
			};
			scoped:
				| {
						name: string;
						value: {
							Version: number;
						};
				  }
				| undefined;
		};
	}>;
};

// Generator for AWS Systems Manager parameters.
// This generator will fetch parameter values from AWS and provide a way to update them.
// Example usage:
// ```typescript
// let parameters = AwsSystemsManagerParameterGenerator({
// 	root,
// });
//
// let parameter = await parameters.next({
// 	template: () => `/my/parameter`,
// });
//
// console.dir({
// 	AwsSystemsManagerParameter: {
// 		message: "Got parameter",
// 		parameter,
// 	},
// });
// ```
export async function* AwsSystemsManagerParameterGenerator({
	root,
	systems,
}: AwsSystemsManagerParameterGeneratorProps) {
	let next: AwsSystemsManagerParameterGeneratorNext;
	while (true) {
		next = yield { $$kind: "next" } as const;
		let rootval = {
			Name: next.template(next.principal),
		};
		let principalval = systems
			? {
					Name: next.template(),
				}
			: { Name: "" };

		let rootparameter = await root.GetParameter({ Name: rootval.Name });
		await new Promise((resolve) =>
			setTimeout(resolve, 500 + Math.random() * 500),
		);
		let scopedparameter = systems
			? await systems.GetParameter({ Name: principalval!.Name })
			: undefined;

		let values = {
			root: rootparameter,
			scoped: scopedparameter,
		};

		let update = async (value: string) => {
			let rootUpdate:
				| Awaited<ReturnType<AwsSystemsManager["PutParameter"]>>
				| undefined;

			if (value !== values.root?.Parameter.Value) {
				rootUpdate = await root.PutParameter({
					Name: rootval.Name,
					Value: value,
					Type: "String",
					Overwrite: true,
				});
				if (values.root) {
					values.root.Parameter.Value = value;
				} else {
					values.root = {
						Parameter: {
							Name: rootval.Name,
							Value: value,
						} as NonNullable<typeof values.scoped>["Parameter"],
					};
				}
			} else {
				console.dir(
					{
						AwsSystemsManagerParameter: {
							message: "Root parameter already up-to-date",
							root: values.root?.Parameter,
							value,
						},
					},
					{ depth: null },
				);
			}

			await new Promise((resolve) =>
				setTimeout(resolve, 500 + Math.random() * 500),
			);

			let scopedUpdate = systems
				? await systems.PutParameter({
						Name: principalval!.Name,
						Value: value,
						Type: "String",
						Overwrite: true,
					})
				: undefined;
			if (systems && value !== values.scoped?.Parameter.Value) {
				scopedUpdate = await systems.PutParameter({
					Name: principalval!.Name,
					Value: value,
					Type: "String",
					Overwrite: true,
				});
				if (values.scoped) {
					values.scoped.Parameter.Value = value;
				} else {
					values.scoped = {
						Parameter: {
							Name: principalval!.Name,
							Value: value,
						} as NonNullable<typeof values.scoped>["Parameter"],
					};
				}
			} else {
				if (systems) {
					console.dir(
						{
							AwsSystemsManagerParameter: {
								message: "Scoped parameter already up-to-date",
								scoped: values.scoped?.Parameter,
								value,
							},
						},
						{ depth: null },
					);
				}
			}

			return {
				$$kind: "updated",
				parameter: {
					root: {
						name: rootval.Name,
						value: rootUpdate,
						parameter: values.root,
					},
					scoped: scopedUpdate
						? {
								name: principalval?.Name,
								value: scopedUpdate,
								parameter: values.scoped,
							}
						: undefined,
				},
			} as const;
		};

		let isDefaulted = false;
		if (next.default && values.root?.Parameter.Value === undefined) {
			let updated = await update(next.default);
			isDefaulted = true;
			if (updated.$$kind !== "updated") {
				throw new VError(
					{
						name: "UPDATE_FAILED",
						info: {
							updated,
						},
					},
					`Failed to update parameter with default value. ${JSON.stringify(
						updated,
					)}`,
				);
			}
			values.root = updated.parameter.root.parameter;

			if (systems) {
				values.scoped = updated.parameter.scoped?.parameter;
			}
		}

		yield {
			$$kind: "loaded" as const,
			isDefaulted: isDefaulted,
			parameter: {
				root: {
					name: rootval.Name,
					value: values.root,
				},
				scoped: systems
					? {
							name: principalval?.Name,
							value: values.scoped,
						}
					: undefined,
			},
			update,
		} satisfies AwsSystemsManagerParameterState & { $$kind: "loaded" };
	}

	// @ts-ignore
	return { $$kind: "done" } as const;
}
