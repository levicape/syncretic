export type CodeCatalystPullrequestTriggerSpec = {
	Type: "PULLREQUEST";
	Events: "OPEN" | "CLOSED" | "REVISION";
	Branches: string[];
	FilesChanged: string[];
};
