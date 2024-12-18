export type CodeCatalystComputeEc2DefaultFleets =
	| "Linux.Arm64.Large"
	| "Linux.Arm64.XLarge"
	| "Linux.x86-64.Large"
	| "Linux.x86-64.XLarge";

export type CodeCatalystComputeEc2Spec<
	Fleet extends string = CodeCatalystComputeEc2DefaultFleets,
> = {
	Type: "EC2";
	Fleet?: Fleet;
	SharedInstance?: boolean;
};
