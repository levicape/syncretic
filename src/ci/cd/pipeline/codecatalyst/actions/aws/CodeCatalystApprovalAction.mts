import type { CodeCatalystAction } from "../../CodeCatalystActionBuilder.mjs";

export type CodeCatalystApprovalConfiguration = {
	ApprovalsRequired: number;
};

export type CodeCatalystApprovalProps<DependsOn extends string> = {
	DependsOn: DependsOn[];
};

export type CodeCatalystApprovalAction<DependsOn extends string> =
	CodeCatalystAction<
		"aws/approval@v1",
		keyof CodeCatalystApprovalConfiguration,
		CodeCatalystApprovalConfiguration,
		CodeCatalystApprovalProps<DependsOn>
	>;
