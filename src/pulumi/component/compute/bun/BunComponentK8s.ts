import { hostname, version } from "node:os";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { ConfigMap, Service } from "@pulumi/kubernetes/core/v1/index.js";
import {
	type ComponentResourceOptions,
	type Output,
	all,
	interpolate,
} from "@pulumi/pulumi/index.js";
import type { RouteMap } from "../../website/WebsiteManifest.js";
import type { ComputeComponentProps } from "../ComputeComponent.js";
import type {
	ComputeComponentK8s,
	ComputeComponentK8sState,
} from "../ComputeComponentK8s.js";
import type { ComputeManifest } from "../ComputeManifest.js";
import { BunComponent } from "./BunComponent.js";

type BunComponentK8sState = ComputeComponentK8sState & {
	configmap?: ConfigMap;
};

interface BunComponentK8sProps extends Omit<ComputeComponentProps, "build"> {
	namespace: Output<string>;
	image: {
		name: Output<string>;
		ref: Output<string>;
		build: {
			root: Output<string>;
		};
	};
	replicas?: number;
	ports?: { containerPort: number }[];
	hostnames?: string[];
	routes?: Output<RouteMap>;
}

export class BunComponentK8s
	extends BunComponent
	implements ComputeComponentK8s
{
	static readonly URN = "compute:k8s::bun";
	public readonly k8s: BunComponentK8sState;
	public readonly manifest:
		| Output<{ ComputeComponent: ComputeManifest }>
		| undefined;

	constructor(
		name: string,
		props: BunComponentK8sProps,
		opts?: ComponentResourceOptions,
	) {
		super(BunComponentK8s.URN, name, props, opts);

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

		const service = new Service(
			`${name}-bun-service`,
			{
				metadata: {
					namespace,
					name: interpolate`${name.replaceAll(".", "--")}-service`,
				},
				spec: {
					type: "ClusterIP",
					selector: {
						app: name,
					},
					ports: ports.map((p) => ({
						port: p.containerPort,
						targetPort: p.containerPort,
						name: `bun-${p.containerPort.toString()}`,
					})),
				},
			},
			{ parent: this },
		);

		let configmap: ConfigMap | undefined;
		if (routes) {
			this.manifest = all([
				routes,
				service.metadata.name,
				image.build.root,
			]).apply(([routes, service, root]) => {
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
								build: root.split("/").pop()!,
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
			const data = this.manifest.apply((manifest) => {
				const buf = Buffer.from(JSON.stringify(manifest));
				return {
					LEAF_MANIFEST: buf.toString("base64"),
				};
			});

			configmap = new ConfigMap(
				`${name}-bun-config`,
				{
					metadata: {
						namespace,
						name: interpolate`${name}-config`,
					},
					data,
				},
				{ parent: this },
			);
		}

		const deployment = new Deployment(
			`${name}-bun-deployment`,
			{
				metadata: {
					namespace,
					name,
					annotations: {
						"leaf.image": image.name,
					},
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
									envFrom: all([envFrom ?? [], configmap?.metadata.name]).apply(
										([envFrom, configmapRef]) => {
											return [
												...envFrom,
												configmapRef !== undefined
													? {
															configMapRef: {
																name: configmapRef,
															},
														}
													: undefined,
											].filter((x) => x !== undefined);
										},
									),
									volumeMounts: [
										{
											name: "buncomponentk8s",
											mountPath: "/code",
										},
									],
								},
							],
							volumes: [
								{
									name: "buncomponentk8s",
									hostPath: {
										path: `/tmp/buncomponentk8s/${name.replace(/[^a-zA-Z0-9]/g, "-")}`,
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

		this.k8s = {
			$kind: "deployment",
			deployment,
			service,
			configmap,
		};

		this.registerOutputs({
			k8s: this.k8s,
			manifest: this.manifest,
		});
	}
}
