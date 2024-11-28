import type { LogGroup } from "@pulumi/aws/cloudwatch/logGroup.js";
import type { Function } from "@pulumi/aws/lambda/function.js";
import type { FunctionUrl } from "@pulumi/aws/lambda/functionUrl.js";

export type ComputeComponentAws = {
	aws: ComputeComponentAwsState;
};
export type ComputeComponentAwsState = {
	lambda: Function;
	monitor: {
		logs: LogGroup;
	};
	http?: {
		url: FunctionUrl;
		cors?: {
			add: (host: string) => void;
			promise: ReturnType<typeof Promise.withResolvers<void>>;
		};
	};
};
