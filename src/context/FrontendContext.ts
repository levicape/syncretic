import { Config } from "@pulumi/pulumi/index.js";
import { registerStackTransformation } from "@pulumi/pulumi/runtime/index.js";
import { isAwsTaggable } from "../component/aws/AwsTags.js";

const CONFIG_NAMESPACE = `frontend`;
const CONFIG_PREFIX = `stack`;
export type Stack = {
	dns?: {
		hostnames?: string[];
	};
};

export class FrontendContext {
	private constructor(readonly dns: Required<Stack["dns"]>) {}

	static async fromConfig(): Promise<FrontendContext> {
		const { dns } =
			new Config(CONFIG_NAMESPACE).getObject<Stack>(CONFIG_PREFIX) ?? {};
		if (dns !== undefined) {
			let { hostnames } = dns;
			if (hostnames === undefined) {
				console.debug({
					FrontendContext: {
						hostnames: `${CONFIG_NAMESPACE}:${CONFIG_PREFIX}.hostnames is unset. Defaulting to "localhost"`,
					},
				});
				hostnames = ["localhost"];
			}

			registerStackTransformation((args) => {
				if (isAwsTaggable(args.type)) {
					args.props.tags = {
						...args.props.tags,
						...{
							"Context__Frontend-Host": hostnames[0].toString(),
							"Context__Frontend-Hostnames": hostnames.toString(),
						},
					};
					return { props: args.props, opts: args.opts };
				}
				return undefined;
			});

			console.debug({
				FrontendContext: {
					hostnames,
					tags: "Context__Frontend-Host",
				},
			});

			return new FrontendContext({ hostnames });
		}

		return new FrontendContext({ hostnames: ["localhost"] });
	}
}
