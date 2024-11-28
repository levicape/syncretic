import { hostname, version } from "node:os";
import { Deployment } from "@pulumi/kubernetes/apps/v1/deployment.js";
import { Service } from "@pulumi/kubernetes/core/v1/service.js";
import {
	type ComponentResourceOptions,
	type Output,
	all,
} from "@pulumi/pulumi/index.js";
import type { RouteMap } from "../../website/WebsiteManifest.js";
import type { ComputeComponentProps } from "../ComputeComponent.js";
import type {
	ComputeComponentK8s,
	ComputeComponentK8sState,
} from "../ComputeComponentK8s.js";
import type { ComputeManifest } from "../ComputeManifest.js";
import { GolangComponent } from "./GolangComponent.js";
import type { GolangDockerImageHandlerResult } from "./GolangDockerImage.js";

interface GolangComponentK8sProps extends Omit<ComputeComponentProps, "build"> {
	namespace: Output<string>;
	image: GolangDockerImageHandlerResult;
	replicas?: number;
	ports: { containerPort: number }[];
	hostnames?: string[];
	routes?: Output<RouteMap>;
}

export class GolangComponentK8s
	extends GolangComponent
	implements ComputeComponentK8s
{
	static readonly URN = "compute:k8s::golang";
	readonly k8s: ComputeComponentK8sState;
	public readonly manifest:
		| Output<{ ComputeComponent: ComputeManifest }>
		| undefined;

	constructor(
		name: string,
		props: GolangComponentK8sProps,
		opts?: ComponentResourceOptions,
	) {
		super(GolangComponentK8s.URN, name, props, opts);
		const {
			namespace,
			image,
			replicas = 1,
			ports,
			envs,
			routes,
			hostnames = [],
			envFrom,
		} = props;

		const deployment = new Deployment(
			`${name}-golang-deployment`,
			{
				metadata: {
					name: `${image.name}`,
					namespace,
				},
				spec: {
					replicas,
					selector: {
						matchLabels: {
							app: name,
						},
					},
					template: {
						metadata: {
							labels: {
								app: name,
							},
						},
						spec: {
							containers: [
								{
									name: image.name,
									image: image.ref,
									ports,
									env: envs?.apply((env) =>
										Object.entries(env).map(([name, value]) => ({
											name,
											value,
										})),
									),
									envFrom,
								},
							],
						},
					},
				},
			},
			{ parent: this },
		);

		const service = new Service(
			`${name}-golang-service`,
			{
				metadata: {
					name: `${image.name}-service`,
					namespace,
				},
				spec: {
					type: "ClusterIP",
					selector: {
						app: name,
					},
					ports: ports.map((port) => ({
						protocol: "TCP",
						port: port.containerPort,
						targetPort: port.containerPort,
					})),
				},
			},
			{ parent: this },
		);

		if (routes) {
			this.manifest = all([
				routes,
				service.metadata.name,
				service.spec.ports,
			]).apply(([routes, service]) => {
				const {
					context: { environment, stage },
				} = props;
				return {
					ComputeComponent: {
						manifest: {
							ok: true,
							routes: {
								...routes,
							},
							frontend: {
								...(environment.isProd
									? {}
									: {
											website: {
												service,
												protocol: "http" as const,
											},
										}),
								hostnames: hostnames,
							},
							version: {
								sequence: Date.now().toString(),
								build: image.build.root.split("/").pop()!,
								stage,
								process: environment.isProd
									? {}
									: {
											pid: process.pid.toString(),
											node: process.version,
											arch: process.arch,
											platform: process.platform,
											os: {
												version: version(),
												hostname: hostname(),
											},
										},
								...(environment.isProd ? {} : { aws: environment.aws }),
							},
						} as const,
					},
				};
			});
		}

		this.k8s = {
			$kind: "deployment",
			deployment,
			service,
		};

		console.debug({
			GolangComponentK8s: {
				message: "Kubernetes resources created",
				deployment: deployment.metadata.name,
				service: service.metadata.name,
			},
		});
	}
}
