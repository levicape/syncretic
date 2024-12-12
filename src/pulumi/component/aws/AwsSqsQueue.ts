import type { PolicyDocument } from "@pulumi/aws/iam/documents.js";
import type { Role } from "@pulumi/aws/iam/role.js";
import type { Region } from "@pulumi/aws/index.js";
import { type Queue, QueuePolicy } from "@pulumi/aws/sqs/index.js";
import {
	type ComponentResource,
	type Output,
	all,
	jsonStringify,
} from "@pulumi/pulumi/index.js";

export class AwsSqsQueue {
	static micronaut() {
		return {
			MICRONAUT_APPLICATION_AMQ_ENABLED: `false`,
			MICRONAUT_APPLICATION_SQS_ENABLED: `true`,
		};
	}

	static environmentVariables<T extends string>(
		prefix: T,
		region: Region,
		queue: Queue,
	): Output<Record<`${T}__${string}`, string>> {
		return all([queue.url, queue.name]).apply(([url, name]) => {
			console.debug({
				AwsSqsQueue: {
					name,
					prefix,
					region,
					url,
				},
			});
			const envs = {
				[`${prefix}__CONNECTION_FACTORY`]: `sqsJmsConnectionFactory`,
				[`${prefix}__URL` as const]: `${url}`,
				[`${prefix}__REGION` as const]: region as string,
				[`${prefix}__NAME` as const]: name as string,
			} as Record<`${T}__${string}`, string>;

			return envs;
		});
	}

	static resourcePolicy = (
		waitFor: ComponentResource,
		queueResourcePrefix: string,
		queues: Array<[string, Queue]>,
		role: Role,
		grant = "sqs:*",
	): Array<QueuePolicy> => {
		return queues.flatMap(
			([queueAlias, queue]) =>
				new QueuePolicy(
					`${queueResourcePrefix}-${queueAlias}-resource-policy`,
					{
						queueUrl: queue.url,
						policy: jsonStringify({
							Version: "2012-10-17",
							Statement: [
								{
									Effect: "Allow",
									Principal: {
										AWS: role.arn,
									},
									Action: [grant],
									Resource: queue.arn,
								},
							],
						} satisfies PolicyDocument),
					},
					{ parent: queue, dependsOn: [waitFor] },
				),
		);
	};
	private _uid = Date.now().toString();
}
