// // Lambda subscribed to SNS topic, triggers Codebuild invalidation.

// const handler = await (async ({ datalayer, codestar }, cloudwatch) => {
// 	const roleArn = datalayer.iam.roles.lambda.arn;
// 	const loggroup = cloudwatch.function.loggroup;

// 	const zip = new BucketObjectv2(_("zip"), {
// 		bucket: s3.artifacts.bucket,
// 		source: new AssetArchive({
// 			"index.js": new StringAsset(
// 				`export const handler = (${(
// 					// @ts-ignore
// 					(_event, context) => {
// 						const {
// 							functionName,
// 							functionVersion,
// 							getRemainingTimeInMillis,
// 							invokedFunctionArn,
// 							memoryLimitInMB,
// 							awsRequestId,
// 							logGroupName,
// 							logStreamName,
// 							identity,
// 							clientContext,
// 							deadline,
// 						} = context;

// 						console.log({
// 							functionName,
// 							functionVersion,
// 							getRemainingTimeInMillis,
// 							invokedFunctionArn,
// 							memoryLimitInMB,
// 							awsRequestId,
// 							logGroupName,
// 							logStreamName,
// 							identity,
// 							clientContext,
// 							deadline,
// 						});

// 						return {
// 							statusCode: 200,
// 							body: JSON.stringify({
// 								message: "Hello from Lambda!",
// 							}),
// 						};
// 					}
// 				).toString()})`,
// 			),
// 		}),
// 		contentType: "application/zip",
// 		key: "http.zip",
// 		tags: {
// 			Name: _(`zip`),
// 			StackRef: STACKREF_ROOT,
// 		},
// 	});

// 	const memorySize = context.environment.isProd ? 512 : 256;
// 	const timeout = context.environment.isProd ? 18 : 11;
// 	const lambda = new LambdaFn(
// 		_("function"),
// 		{
// 			description: `(${PACKAGE_NAME}) "${DESCRIPTION ?? `HTTP lambda`}" in #${stage}`,
// 			role: roleArn,
// 			architectures: ["arm64"],
// 			memorySize,
// 			timeout: timeout,
// 			packageType: "Zip",
// 			runtime: Runtime.NodeJS22dX,
// 			handler: "index.handler",
// 			s3Bucket: s3.artifacts.bucket,
// 			s3Key: zip.key,
// 			s3ObjectVersion: zip.versionId,
// 			vpcConfig: {
// 				securityGroupIds: datalayer.props.lambda.vpcConfig.securityGroupIds,
// 				subnetIds: datalayer.props.lambda.vpcConfig.subnetIds,
// 			},
// 			fileSystemConfig: {
// 				localMountPath:
// 					datalayer.props.lambda.fileSystemConfig.localMountPath,
// 				arn: datalayer.props.lambda.fileSystemConfig.arn,
// 			},
// 			loggingConfig: {
// 				logFormat: "JSON",
// 				logGroup: loggroup.name,
// 				applicationLogLevel: context.environment.isProd ? "INFO" : "DEBUG",
// 			},
// 			layers: [
// 				// TODO: RIP mapping
// 				`arn:aws:lambda:us-west-2:359756378197:layer:AWS-AppConfig-Extension-Arm64:132`,
// 			],
// 			environment: all([cloudmapEnvironment, appconfigEnvironment]).apply(
// 				([cloudmap, appconfig]) => {
// 					return {
// 						variables: {
// 							NODE_OPTIONS: [
// 								"--no-force-async-hooks-checks",
// 								"--enable-source-maps",
// 							].join(" "),
// 							NODE_ENV: "production",
// 							LOG_LEVEL: "5",
// 						},
// 					};
// 				},
// 			),
// 			tags: {
// 				Name: _("function"),
// 				StackRef: STACKREF_ROOT,
// 				Handler: "Http",
// 				PackageName: PACKAGE_NAME,
// 			},
// 		},
// 		{
// 			dependsOn: [zip],
// 			ignoreChanges: ["handler", "s3Bucket", "s3Key", "s3ObjectVersion"],
// 		},
// 	);

// 	return {
// 		http: {
// 			arn: lambda.arn,
// 			name: lambda.name,
// 		},
// 		role: datalayer.props.lambda.role,
// 	};
// })({ codestar: __codestar, datalayer: __datalayer });
