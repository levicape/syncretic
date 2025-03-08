import { inspect } from "node:util";
import { Config } from "@pulumi/pulumi/index.js";
import { debug } from "@pulumi/pulumi/log/index.js";
import { registerStackTransformation } from "@pulumi/pulumi/runtime/index.js";
import { isAwsTaggable } from "../components/aws/AwsTags.cjs";

const CONFIG_NAMESPACE = `frontend`;
const CONFIG_PREFIX = `stack`;
export type FrontendStack = {
	dns?: {
		hostnames?: string[];
	};
};

export class FrontendContext {
	private constructor(readonly dns: Required<FrontendStack["dns"]>) {}

	static async fromConfig(): Promise<FrontendContext> {
		const { dns } =
			new Config(CONFIG_NAMESPACE).getObject<FrontendStack>(CONFIG_PREFIX) ??
			{};
		if (dns !== undefined) {
			let { hostnames } = dns;
			if (hostnames === undefined) {
				debug(
					inspect(
						{
							FrontendContext: {
								hostnames: `${CONFIG_NAMESPACE}:${CONFIG_PREFIX}.hostnames is unset. Defaulting to "localhost"`,
							},
						},
						{ depth: null },
					),
				);
				hostnames = ["localhost"];
			}

			registerStackTransformation((args) => {
				if (isAwsTaggable(args.type)) {
					args.props.tags = {
						...args.props.tags,
						...{
							"Context__Frontend-Host": hostnames[0]?.toString() ?? "",
							...Object.fromEntries(
								hostnames
									.filter(
										(hostname) =>
											hostname.length > 0 && hostname !== "localhost",
									)
									.filter((hostname) => hostname.length < 256)
									.map((hostname, index) => [
										`Context__Frontend-Host-${index}`,
										hostname,
									]),
							),
						},
					};
					return { props: args.props, opts: args.opts };
				}
				return undefined;
			});

			debug(
				inspect(
					{
						FrontendContext: {
							hostnames,
							tags: "Context__Frontend-Host",
						},
					},
					{ depth: null },
				),
			);

			return new FrontendContext({ hostnames });
		}

		return new FrontendContext({ hostnames: ["localhost"] });
	}
}
