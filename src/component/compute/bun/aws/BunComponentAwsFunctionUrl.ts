import { FunctionUrl } from "@pulumi/aws/lambda/functionUrl.js";
import type { ComponentResource, Output } from "@pulumi/pulumi/index.js";

export type FunctionUrlProps = {
	name: string;
	functionName: Output<string>;
	authorizationType: "AWS_IAM" | "NONE";
	allowOrigins: string[];
	parent: ComponentResource;
};
export type FunctionUrlState = {
	url: FunctionUrl;
};

export const BunComponentAwsFunctionUrl = ({
	name,
	functionName,
	authorizationType,
	allowOrigins,
	parent,
}: FunctionUrlProps): FunctionUrlState => {
	const functionUrl = new FunctionUrl(
		`${name}-Bun--lambda-url`,
		{
			functionName,
			authorizationType,
			cors: {
				allowMethods: ["*"],
				allowOrigins,
				maxAge: 86400,
			},
		},
		{
			parent,
		},
	);

	return { url: functionUrl };
};
