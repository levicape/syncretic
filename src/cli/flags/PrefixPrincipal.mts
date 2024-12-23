import VError from "verror";
import { AwsPrincipalNameFromPackageJson } from "../context/PackageJson.mjs";

export type PrefixPrincipalFlags = {
	prefix?: string;
	principal?: string;
	// from?: {
	// 	path: string;
	// 	format: "npm";
	// }
};

export type PrefixPrincipalConfiguration<
	Required extends boolean | never = false,
> = {
	required?: Required;
};

export const PrefixPrincipalParameterFlags = () =>
	({
		principal: {
			brief:
				"Name of the principal. Defaults to URL-safe root package.json name. Mutually exclusive with prefix",
			kind: "parsed",
			parse: (value: string) => {
				if (value.trim().length === 0) {
					throw new VError(
						{
							name: "PrincipalCommand",
							message: "Name should be a non-empty string",
						},
						"Name should be non-empty",
					);
				}
				return value;
			},
			optional: true,
		},
		prefix: {
			brief:
				"Prefix for the principal. This option will search the root package.json for a matching repository entry. Supported repository protocols: github. Mutually exclusive with name. Must be set if name is not set",
			kind: "parsed",
			parse: (value: string) => value,
			optional: true,
		},
	}) as const;

export class PrefixPrincipal<Required extends boolean | never = false> {
	private prefix?: string;
	private principal?: string;
	private required?: Required;

	constructor(
		{ prefix, principal }: PrefixPrincipalFlags,
		{ required }: PrefixPrincipalConfiguration<Required> = {},
	) {
		this.prefix = prefix;
		this.principal = principal;
		this.required = required;
	}

	build = async (): Promise<
		Required extends true ? string : string | undefined
	> => {
		if (this.prefix && this.principal) {
			throw new VError(
				{
					name: "INVALID_FLAGS",
				},
				`Cannot specify both prefix and principal. Received ${JSON.stringify({
					prefix: this.prefix,
					principal: this.principal,
				})}`,
			);
		}

		if (this.required) {
			if (!this.prefix && !this.principal) {
				throw new VError(
					{
						name: "INVALID_FLAGS",
					},
					`Must specify either prefix or principal. Received ${JSON.stringify({
						prefix: this.prefix,
						principal: this.principal,
					})}`,
				);
			}
		}

		if (this.prefix) {
			// TODO: From flag
			let packagerepo = await AwsPrincipalNameFromPackageJson({
				prefix: this.prefix,
			});

			return packagerepo;
		}

		return this.principal as string;
	};
}
