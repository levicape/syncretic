export type CodeCatalystPullrequestTriggerSpec = {
	Type: "PULLREQUEST";
	Events:
		| Array<"OPEN" | "CLOSED" | "REVISION">
		| ReadonlyArray<"OPEN" | "CLOSED" | "REVISION">;
	Branches: string[] | ReadonlyArray<string>;
	FilesChanged?: string[] | ReadonlyArray<string>;
};
