export type CodeCatalystComputeLambdaSpec = {
	Type: "LAMBDA";
	Fleet:
		| "Linux.x86-64.Large"
		| "Linux.x86-64.XLarge"
		| "Linux.x86-64.2XLarge"
		| "Linux.Arm64.Large"
		| "Linux.Arm64.XLarge"
		| "Linux.Arm64.2XLarge";
};
