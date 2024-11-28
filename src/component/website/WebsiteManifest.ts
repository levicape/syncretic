export type RouteProtocol = "http" | "https" | "ws" | "wss";
export type Url = `${RouteProtocol}://${string}`;
export type Service = string;
export type Prefix = `/${string}/v${number}/${string}`;
export type LambdaRouteResource = {
	lambdaName: string;
};
export type KubernetesRouteResource = {
	serviceName: string;
	port: number;
};
export type NoRouteResource = { [key: symbol]: never };
export type RouteResource =
	| LambdaRouteResource
	| KubernetesRouteResource
	| NoRouteResource;
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
