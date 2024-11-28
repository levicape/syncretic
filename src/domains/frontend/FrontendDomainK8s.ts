import { Ingress } from "@pulumi/kubernetes/networking/v1";
import {
	ComponentResource,
	type ComponentResourceOptions,
	type Input,
	type Output,
} from "@pulumi/pulumi/index.js";
import type { ComputeArtifactLayer } from "../../component/compute/ComputeArtifactLayer.js";
import type { ComputeComponentK8s } from "../../component/compute/ComputeComponentK8s.js";
import type { ComputeDockerImageHandlerResult } from "../../component/compute/ComputeDockerImage.js";
import type {
	KubernetesRouteResource,
	RouteMap,
} from "../../component/website/WebsiteManifest.js";
import type { FrontendDomainProps } from "./FrontendDomain.js";

export interface FrontendDomainK8sProps
	extends Omit<FrontendDomainProps<KubernetesRouteResource>, "build" | "init"> {
	build:
		| {
				compute: ComputeDockerImageHandlerResult;
				artifact?: never;
		  }
		| {
				compute?: never;
				artifact: ComputeArtifactLayer;
		  };
	init:
		| {
				compute?: (
					image: ComputeDockerImageHandlerResult,
					parent: FrontendDomainK8s,
					routes: Output<RouteMap<KubernetesRouteResource>>,
				) => ComputeComponentK8s;
				artifact?: never;
		  }
		| {
				compute?: never;
				artifact: (
					image: ComputeArtifactLayer,
					parent: FrontendDomainK8s,
					routes: Output<RouteMap<KubernetesRouteResource>>,
				) => ComputeComponentK8s;
		  };
	namespace: Output<string>;
	ingressClass: Input<string>;
}

export type FrontendDomainK8sState = {
	http: {
		website: ComputeComponentK8s;
		ingress: Ingress;
	};
};

export class FrontendDomainK8s extends ComponentResource {
	static readonly URN = "@frontend:k8s::domain";
	public readonly k8s: FrontendDomainK8sState;

	constructor(
		name: string,
		{
			context,
			build,
			routes,
			namespace,
			ingressClass,
			init,
		}: FrontendDomainK8sProps,
		opts?: ComponentResourceOptions,
	) {
		super(FrontendDomainK8s.URN, name, {}, opts);

		const { frontend } = context;

		if (!frontend || !frontend.dns) {
			throw new Error("Frontend not found in context");
		}

		this.k8s = (() => {
			const {
				dns: { hostnames },
			} = frontend;

			let compute: ComputeComponentK8s;
			if (build.compute && init.compute) {
				compute = init.compute(build.compute, this, routes);
			} else {
				if (!build.artifact || !init.artifact) {
					throw new Error(`Either build.compute or build.artifact must be provided.
Please verify: ${name}
build: ${JSON.stringify(build)}
init: ${JSON.stringify(init)}
					`);
				}
				compute = init.artifact(build.artifact, this, routes);
			}

			const ingress = new Ingress(
				`${name}-default-ingress`,
				{
					metadata: {
						namespace,
						name: `${name}-ingress`,
					},
					spec: {
						ingressClassName: ingressClass,
						rules: hostnames.map((host) => {
							if (compute.k8s.$kind !== "deployment") {
								throw new Error(
									`Expected ComputeComponentK8s to be a Deployment, but got ${compute.k8s.$kind}`,
								);
							}
							const defaultpath = {
								path: "/",
								pathType: "Prefix",
								backend: {
									service: {
										name: compute.k8s.service.metadata.name,
										port: {
											number: compute.k8s.service.spec.ports[0].port,
										},
									},
								},
							};

							const paths = routes.apply((routeMap) => {
								return [
									defaultpath,
									...Object.entries(routeMap).flatMap(([, routes]) => {
										return Object.entries(routes).map(([path, route]) => ({
											path,
											pathType: "Prefix",
											backend: {
												service: {
													name: route.serviceName,
													port: {
														number: route.port,
													},
												},
											},
										}));
									}),
								];
							});

							return {
								host,
								http: {
									paths,
								},
							};
						}),
					},
				},
				{ parent: this },
			);

			return {
				http: {
					website: compute,
					ingress,
				},
			};
		})();
	}
}
