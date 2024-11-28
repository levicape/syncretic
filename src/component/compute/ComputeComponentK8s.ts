import type { Deployment } from "@pulumi/kubernetes/apps/v1/deployment.js";
import type { CronJob } from "@pulumi/kubernetes/batch/v1/cronJob.js";
import type { Job } from "@pulumi/kubernetes/batch/v1/job.js";
import type { ConfigMap } from "@pulumi/kubernetes/core/v1/configMap.js";
import type { Service } from "@pulumi/kubernetes/core/v1/service.js";
import type { Output, UnwrappedObject } from "@pulumi/pulumi/index.js";

export type ComputeComponentK8sState = {
	$kind: "deployment";
	deployment: Deployment;
	service: Service;
};

export type ComputeComponentK8sJobState = {
	$kind: "job";
	configmap?: ConfigMap;
	job: Job;
};

export type ComputeComponentK8sScheduledState = {
	$kind: "scheduled";
	configmap?: ConfigMap;
	cron: CronJob;
};

export type ComputeK8sEnv = Output<{
	envs: {
		[x: string]: string;
	};
	envFrom: UnwrappedObject<{
		prefix: string;
		secretRef: {
			name: Output<string>;
		};
	}>[];
}>;

export interface ComputeComponentK8s {
	readonly k8s:
		| ComputeComponentK8sState
		| ComputeComponentK8sScheduledState
		| ComputeComponentK8sJobState;
}
