import { hostname, version } from "node:os";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service } from "@pulumi/kubernetes/core/v1/index.js";
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
import type { ComputeDockerImageHandlerResult } from "../ComputeDockerImage.js";
import type { ComputeManifest } from "../ComputeManifest.js";
import { NodejsComponent } from "./NodejsComponent.js";

type NodejsComponentK8sState = ComputeComponentK8sState;

interface NodejsComponentK8sProps extends Omit<ComputeComponentProps, "build"> {
	namespace: Output<string>;
	image: ComputeDockerImageHandlerResult;
	replicas?: number;
	ports?: { containerPort: number }[];
	hostnames?: string[];
	routes?: Output<RouteMap>;
}

export class NodejsComponentK8s
	extends NodejsComponent
	implements ComputeComponentK8s
{
	static readonly URN = "compute:k8s::nodejs";
	public readonly k8s: NodejsComponentK8sState;
	public readonly manifest:
		| Output<{ ComputeComponent: ComputeManifest }>
		| undefined;

	constructor(
		name: string,
		props: NodejsComponentK8sProps,
		opts?: ComponentResourceOptions,
	) {
		super(NodejsComponentK8s.URN, name, props, opts);

		const {
			namespace,
			image,
			replicas = 1,
			ports = [{ containerPort: 8080 }],
			hostnames = [],
			routes,
			envs,
			envFrom,
		} = props;

		// Define the Deployment
		const deployment = new Deployment(
			`${name}-nodejs-deployment`,
			{
				metadata: {
					namespace,
					name: `${image.name}`,
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
									name: `${image.name}`,
									image: image.ref,
									ports,
									env: all([envs ?? {}, routes ?? {}]).apply(
										([env, routemap]) => [
											...Object.entries(env).map(([name, value]) => ({
												name,
												value,
											})),
											...Object.entries(routemap).flatMap(([name, value]) =>
												typeof value === "object"
													? [
															...Object.entries(value).flatMap((v) => ({
																name: `z${v[0]
																	.replace(/[^a-zA-Z0-9]/g, "_")
																	.toUpperCase()}`,
																value: JSON.stringify(v[1]),
															})),
														]
													: [],
											),
										],
									),
									envFrom,
									volumeMounts: [
										{
											name: "tarrasqr-c",
											mountPath: "/code",
										},
									],
								},
							],
							volumes: [
								{
									name: "tarrasqr-c",
									hostPath: {
										path: "/tmp/tarrasqr-polaris-code-bucket",
										type: "",
									},
								},
							],
						},
					},
				},
			},
			{ parent: this },
		);

		const service = new Service(
			`${name}-nodejs-service`,
			{
				metadata: {
					namespace,
					name: `${image.name}-service`,
				},
				spec: {
					type: "ClusterIP",
					selector: {
						app: name,
					},
					ports: ports.map((p) => ({
						port: p.containerPort,
						targetPort: p.containerPort,
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

		this.registerOutputs({
			k8s: this.k8s,
			manifest: this.manifest,
		});
	}
}
