import type {
	ManifestVersion,
	Prefix,
	Route,
	RouteMap,
	RouteResource,
} from "../website/WebsiteManifest.js";

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
