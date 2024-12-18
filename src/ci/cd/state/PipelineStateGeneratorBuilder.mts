import VError from "verror";

export type PipelineStateGeneratorBuilderProps = {
	template: {
		env: (val: string) => string;
		secret: (val: string) => string;
	};
};

export const PipelineStateGeneratorBuilder = (
	props: PipelineStateGeneratorBuilderProps,
) => {
	let registered: Record<string, unknown> = {};
	let env: Record<string, unknown> = {};
	let secret: Record<string, unknown> = {};
	let collect = (
		kind: "env" | "secret" | "register",
		key: string,
		ref?: unknown,
	) => {
		let value = "";
		let history = [];
		return {
			$kind: kind,
			$key: key,
			next: (val?: string) => {
				if (val === undefined) {
					throw new VError(`Could not find a value for ${key} in (${kind}.)`);
				}
				if (val !== "") {
					history.push(val);
				}
				value = val;
			},
			value: () => value,
			ref: <T,>() => ref as T,
		};
	};

	let state = {
		register: (function* () {
			while (true) {
				const input: [string, string] = yield "init";
				let [key, value] = input;
				if (!(key in registered)) {
					registered[key] = collect("register", key, value);
				}
				yield { [key]: value };
			}
		})(),
		env: (function* () {
			while (true) {
				const val: string = yield "init";
				if (!(val in env)) {
					env[val] = collect("env", val);
				}
				let templated = props.template.env(val);
				yield templated;
				// yield `\${{ env.${val} }}`;
			}
		})(),
		secret: (function* () {
			while (true) {
				const val: string = yield "init";
				if (!(val in secret)) {
					secret[val] = collect("secret", val);
				}
				let templated = props.template.secret(val);
				yield templated;
				// yield `\${{ secrets.${val} }}`;
			}
		})(),
		maps: {
			registered,
			env,
			secret,
		} as const,
	} as const;

	return state;
};
