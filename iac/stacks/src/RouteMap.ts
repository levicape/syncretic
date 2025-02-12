import { z } from "zod";

export type RouteProtocol = "http" | "https" | "ws" | "wss";
export type Url = `${RouteProtocol}://${string}`;
export type Service = string;
export type Prefix = `/${"!" | "~" | "-"}/v${number}/${string}`;
export type LambdaRouteResource = {
	$kind: "LambdaRouteResource";
	lambda: {
		arn: string;
		name: string;
		role: {
			arn: string;
			name: string;
		};
		qualifier?: string;
	};
	cloudmap?: {
		namespace: {
			arn: string;
			name: string;
			id: string;
			hostedZone: string;
		};
		service: {
			arn: string;
			name: string;
		};
		instance: {
			id: string;
			attributes?: Record<string, string>;
		};
	};
};
export type NoRouteResource = { [key: symbol]: never };
export type RouteResource = LambdaRouteResource | NoRouteResource;
export type Route<T = {}> = {
	url?: string;
	cdn?: string;
	protocol?: RouteProtocol;
} & T;

export type RoutePaths<
	Paths extends Prefix,
	Resource extends RouteResource | {},
> = Record<Paths, Route<Resource>>;

export type RouteMap<
	Resource extends RouteResource | {} = {},
	Paths extends Prefix = Prefix,
> = Record<Service, RoutePaths<Paths | Prefix, Resource>>;

export const RouteMapZod = z.record(
	z.record(
		z.object({
			$kind: z.literal("LambdaRouteResource"),
			url: z.string().optional(),
			cdn: z.string().optional(),
			protocol: z
				.union([
					z.literal("http"),
					z.literal("https"),
					z.literal("ws"),
					z.literal("wss"),
				])
				.optional(),
			lambda: z.object({
				arn: z.string(),
				name: z.string(),
				qualifier: z.string().optional(),
				role: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
			cloudmap: z
				.object({
					namespace: z.object({
						arn: z.string(),
						name: z.string(),
						id: z.string(),
						hostedZone: z.string(),
					}),
					service: z.object({
						arn: z.string(),
						name: z.string(),
					}),
					instance: z.object({
						id: z.string(),
						attributes: z.record(z.string()).optional(),
					}),
				})
				.optional(),
		}),
	),
);

type RouteMapZodType = z.infer<typeof RouteMapZod>;
type RouteMapZodTypecheck = RouteMapZodType extends Record<
	string,
	Record<string, Route<LambdaRouteResource>>
>
	? true
	: false;

// @ts-ignore
const _routeMapZodTypecheck: RouteMapZodTypecheck = true;

// biome-ignore lint/suspicious/noExplicitAny:
export type ManifestVersion = any;
export interface WebsiteManifest {
	manifest:
		| {
				ok: true;
				routes: Record<
					keyof RouteMap,
					Record<
						keyof RouteMap[string],
						Omit<RouteMap[string][Prefix], keyof RouteResource>
					>
				>;
				frontend: {
					website?: Omit<Route, keyof RouteResource>;
					hostnames: string[];
				};
				version: ManifestVersion & { build: string; stage: string };
		  }
		| { ok: false };
}

export interface ComputeManifest {
	manifest: {
		ok: true;
		routes: Record<
			keyof RouteMap,
			Record<
				keyof RouteMap[string],
				Omit<RouteMap[string][Prefix], keyof RouteResource>
			>
		>;
		frontend: {
			website?: Omit<Route, keyof RouteResource>;
			hostnames: string[];
		};
		version: ManifestVersion;
	};
}
