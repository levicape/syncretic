import {
	ComponentResource,
	type ComponentResourceOptions,
	type Output,
} from "@pulumi/pulumi/index.js";
import type { Context } from "../../../context/Context.js";
import type { ComputeArtifactLayer } from "../../component/compute/ComputeArtifactLayer.js";
import type {
	ComputeComponent,
	ComputeComponentBuildResult,
} from "../../component/compute/ComputeComponent.js";
import type {
	WebsiteComponent,
	WebsiteComponentBuildResult,
} from "../../component/website/WebsiteComponent.js";
import type {
	NoRouteResource,
	RouteMap,
	RouteResource,
} from "../../component/website/WebsiteManifest.js";

export type FrontendComponentInit<
	Build,
	Parent,
	Compute,
	Resource extends {},
> = (
	image: Build,
	parent: Parent,
	routes: Output<RouteMap<Resource>>,
	assetUrl?: Output<string>,
) => Compute;

export interface FrontendDomainProps<
	Resource extends RouteResource = NoRouteResource,
	Compute = ComputeComponent | ComputeArtifactLayer,
	Assets = WebsiteComponent,
> {
	context: Context;
	computePrefix?: string;
	build:
		| {
				$type: "docker";
				compute: ComputeComponentBuildResult;
				assets: WebsiteComponentBuildResult;
		  }
		| {
				$type: "artifact";
				compute: ComputeArtifactLayer;
		  };
	init:
		| {
				$type: "docker";
				compute: FrontendComponentInit<
					ComputeComponentBuildResult,
					FrontendDomain<Resource>,
					Compute,
					Resource
				>;
				assets: FrontendComponentInit<
					WebsiteComponentBuildResult,
					FrontendDomain<Resource>,
					Assets,
					Resource
				>;
		  }
		| {
				$type: "artifact";
				compute: FrontendComponentInit<
					ComputeArtifactLayer,
					FrontendDomain<Resource>,
					Compute,
					Resource
				>;
		  };
	routes: Output<RouteMap<Resource>>;
}

export class FrontendDomain<
	TRouteResource extends RouteResource,
> extends ComponentResource {
	constructor(
		urn: string,
		name: string,
		_: FrontendDomainProps<TRouteResource>,
		opts?: ComponentResourceOptions,
	) {
		super(urn, name, {}, opts);
	}
}
