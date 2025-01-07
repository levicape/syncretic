import { getCallerIdentity } from "@pulumi/aws/getCallerIdentity.js";
import { Config, getProject, getStack } from "@pulumi/pulumi/index.js";
import { registerStackTransformation } from "@pulumi/pulumi/runtime/index.js";
import type { AwsEnvironment } from "../components/aws/AwsEnvironment.js";
import { isAwsTaggable } from "../components/aws/AwsTags.js";
import { FrontendContext } from "./FrontendContext.js";

const CONFIG_NAMESPACE = `context`;
const CONFIG_PREFIX = `stack`;
const FEATURES = ["aws", "k8s"] as const;
export type Feature = (typeof FEATURES)[number];
export type FeatureString = `` | `${Feature}` | `${Feature},${Feature}`;
export type Stack = {
	bootstrap?: {
		enabled?: boolean;
	};
	environment?: {
		isProd?: boolean;
		features: FeatureString | Feature[];
	};
};
export const EXAMPLE: Stack = {
	bootstrap: {
		enabled: true,
	},
	environment: {
		isProd: true,
		features: "aws",
	},
};
export interface Environment {
	isProd: boolean;
	features: Feature[];
	aws?: AwsEnvironment;
}
export class Context {
	static _PREFIX_TAG = "Context__Prefix" as const;
	private constructor(
		readonly environment: Environment,
		readonly stage: string,
		readonly prefix: string,
		readonly bootstrap?: boolean,
		readonly frontend?: FrontendContext,
	) {}

	static async fromConfig(): Promise<Context> {
		const { bootstrap, environment } = new Config(
			CONFIG_NAMESPACE,
		).requireObject<Stack>(CONFIG_PREFIX);
		if (bootstrap === undefined || environment === undefined) {
			throw new Error(
				`Please define ${CONFIG_NAMESPACE}:${CONFIG_PREFIX}. Example object: \n${JSON.stringify(EXAMPLE, null, 4)}`,
			);
		}
		const { isProd, features: featureString } = environment;
		const { enabled } = bootstrap;
		if (isProd === undefined || enabled === undefined) {
			throw new Error(
				`Please define ${CONFIG_NAMESPACE}:${CONFIG_PREFIX}. Example object: \n${JSON.stringify(EXAMPLE, null, 4)}`,
			);
		}
		let features: Feature[] = [];
		if (featureString !== undefined) {
			if (Array.isArray(featureString)) {
				features = featureString;
			} else {
				features = featureString
					.split(",")
					.map((f) => f.trim())
					.filter((f) => {
						if (!FEATURES.includes(f as Feature)) {
							throw new Error(
								`Feature ${f} is not supported. Supported features: ${FEATURES.join(", ")}`,
							);
						}
						return true;
					}) as Feature[];
			}
		}

		const aws: AwsEnvironment | undefined =
			process.env.AWS_REGION !== undefined
				? {
						accountArn: (await getCallerIdentity()).arn,
						accountId: (await getCallerIdentity()).accountId,
						region: process.env.AWS_REGION! as AwsEnvironment["region"],
					}
				: undefined;

		const env = {
			isProd,
			aws,
			features,
		};

		const project = getProject();
		let stage = getStack().replaceAll(`${project}.`, ``);
		stage = stage.replaceAll(`.`, `-`);
		const prefix = `${getProject()}-${stage}`;
		const now = Date.now();

		registerStackTransformation((args) => {
			if (isAwsTaggable(args.type)) {
				args.props.tags = {
					...args.props.tags,
					...{
						Pulumi__Name: args.name,
						Pulumi__Type: args.type,
						"Pulumi__Opts-Urn": args.opts.urn,
						"Pulumi__Opts-Version": args.opts.version,
						[Context._PREFIX_TAG]: prefix,
						Context__Stage: stage,
						[prefix.replaceAll(".", "_")]: `${args.name}+${args.type}`,
					},
				};
				return { props: args.props, opts: args.opts };
			}
			return undefined;
		});

		console.debug({
			Context: {
				config: {
					env,
					stage,
					prefix,
					enabled,
					now,
				},
				tags: [
					"Pulumi__Name",
					"Pulumi__Type",
					"Pulumi__Now",
					"Pulumi__Previous",
					"Pulumi__Opts-Urn",
					"Pulumi__Opts-Version",
					Context._PREFIX_TAG,
					"Context__Stage",
					prefix.replaceAll(".", "_"),
				],
			},
		});

		return new Context(
			env,
			stage,
			prefix,
			enabled,
			await FrontendContext.fromConfig(),
		);
	}
}
