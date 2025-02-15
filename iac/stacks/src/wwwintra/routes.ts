import type { RoutePaths, RouteResource } from "../RouteMap";

export class WWWIntraRoutes {
	static readonly REQUIRED_ROUTES = ["/~/v1/Fourtwo/Panel"] as const;
}

export type WWWIntraRoute = (typeof WWWIntraRoutes.REQUIRED_ROUTES)[number];
export type WWWIntraRouteMap<Resource extends RouteResource> = RoutePaths<
	WWWIntraRoute,
	Resource
>;
