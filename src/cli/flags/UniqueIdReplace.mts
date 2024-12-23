import VError from "verror";
import { AwsPrincipalNameFromPackageJson } from "../context/PackageJson.mjs";

export type UniqueIdReplaceFlags<Replace extends boolean | never> = {
	uniqueId?: string;
	replace?: Replace;
};

export type UniqueIdReplaceFlagNoReplace = UniqueIdReplaceFlags<never>;

export const UniqueIdReplaceDefaultParseArn = (value?: string) => {
	return value
		?.split(":")[5]
		?.split("/")[1]
		?.split("---")[0]
		?.replace(/^ft-/, "");
};
export const UniqueIdReplaceDefaultResourceName = (
	value: string,
	id: string,
) => {
	return `ft-${id}---${value}`;
};
export type UniqueIdReplaceConfiguration = {
	region: string;
	parameter: {
		value: Promise<string | undefined>;
		parse: (value?: string) => string | undefined;
		named: (value: string, id: string) => string;
	};
};

export const UniqueIdReplaceParameterFlags = () =>
	({
		uniqueId: {
			brief:
				"Set a static unique ID for this resource. Will be generated if not set.",
			kind: "parsed",
			parse: (value: string) => value,
			optional: true,
		},
		replace: {
			brief: "Replace the unique ID with a new one.",
			kind: "boolean",
			optional: true,
		},
	}) as const;

// () => ScopedResourceName

export class UniqueIdReplace<Replace extends boolean | never> {
	private flags: UniqueIdReplaceFlags<Replace>;
	private configuration: UniqueIdReplaceConfiguration;
	private previousId: string | undefined;
	private uniqueId: string | undefined;

	constructor(
		flags: UniqueIdReplaceFlags<Replace>,
		configuration: UniqueIdReplaceConfiguration,
	) {
		this.flags = flags;
		this.configuration = configuration;
	}

	static uniqueId = () => {
		// Scan for words before returning. For now we will replace vowels with a random number (not 0, 7, 3, 1)
		let generated = Math.random().toString(36).substring(3);
		let numbers = ["2", "9", "8", "4", "5"];
		let chosen = numbers.pop() ?? "6";
		generated = generated.replace(/a/g, chosen);
		chosen = numbers.pop() ?? "5";
		generated = generated.replace(/e/g, chosen);
		chosen = numbers.pop() ?? "4";
		generated = generated.replace(/i/g, chosen);
		chosen = numbers.pop() ?? "2";
		generated = generated.replace(/o/g, chosen);
		chosen = numbers.pop() ?? "6";
		generated = generated.replace(/u/g, chosen);

		// Replace 0, 7, 3, 1 with a value from [x, y, z, w]
		let values = ["x", "y", "z", "w"];
		generated = generated.replace(
			/0/g,
			values[Math.floor(Math.random() * values.length)],
		);
		generated = generated.replace(
			/7/g,
			values[Math.floor(Math.random() * values.length)],
		);
		generated = generated.replace(
			/3/g,
			values[Math.floor(Math.random() * values.length)],
		);
		generated = generated.replace(
			/1/g,
			values[Math.floor(Math.random() * values.length)],
		);

		// Replace starting letter if digit with a random letter
		if (generated.match(/^\d/)) {
			let letters = "abcdefghijklmnopqrstuvwxyz";
			let random = Math.floor(Math.random() * letters.length);
			generated = letters[random] + generated.substring(1);
		}

		return generated;
	};

	build = async (): Promise<{
		previousUniqueId: string | undefined;
		uniqueId: string;
	}> => {
		let { flags, configuration } = this;
		if (this.uniqueId) {
			return {
				previousUniqueId: this.previousId,
				uniqueId: this.uniqueId,
			};
		}

		let replace = flags.replace ?? false;
		let requestedUniqueId = flags.uniqueId;

		// Load previous id from configuration if it is not set
		if (this.previousId === undefined) {
			this.previousId = await configuration.parameter.value;
			this.previousId = configuration.parameter.parse(this.previousId);
		}

		// Error if uniqueId, no replace is set but existing id is not the same
		if (
			requestedUniqueId &&
			!replace &&
			requestedUniqueId !== this.previousId
		) {
			throw new VError(
				{
					name: "INVALID_FLAGS",
				},
				`Cannot set a unique ID of ${requestedUniqueId} when the existing ID is ${this.previousId}`,
			);
		}

		// If replace, return new id
		if (replace) {
			this.uniqueId = UniqueIdReplace.uniqueId();
		} else {
			// If not replace, return previousId. If previousId is not set return requestedId or generate new id if none requested
			this.uniqueId =
				this.previousId ?? requestedUniqueId ?? UniqueIdReplace.uniqueId();
		}

		return {
			previousUniqueId: this.previousId,
			uniqueId: this.uniqueId,
		};
	};

	scoped = async (resource: string) => {
		let { configuration } = this;
		let { region, parameter } = configuration;
		let { named } = parameter;

		let { uniqueId } = await this.build();
		let resourceName = named(resource, uniqueId);

		return {
			region,
			resourceName,
		};
	};
}
