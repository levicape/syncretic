import { CodeCatalystActionBuilder } from "../../../CodeCatalystActionBuilder.mjs";
import type { CodeCatalystApprovalAction } from "../CodeCatalystApprovalAction.mjs";

export type CodeCatalystApprovalXConfiguration = {
	approvalsRequired: number;
};

export type CodeCatalystApprovalXProps<DependsOn extends string> = {
	dependsOn?: DependsOn[];
	configuration: CodeCatalystApprovalXConfiguration;
};

export const CodeCatalystApprovalX = <DependsOn extends string>(
	props: CodeCatalystApprovalXProps<DependsOn>,
): CodeCatalystActionBuilder<
	CodeCatalystApprovalAction<DependsOn>["Identifier"],
	DependsOn,
	keyof CodeCatalystApprovalAction<DependsOn>["Configuration"],
	CodeCatalystApprovalAction<DependsOn>["Configuration"],
	{
		DependsOn: CodeCatalystApprovalAction<DependsOn>["DependsOn"];
	}
> => {
	const { dependsOn, configuration } = props;
	const factory = new CodeCatalystActionBuilder<
		CodeCatalystApprovalAction<DependsOn>["Identifier"],
		DependsOn,
		keyof CodeCatalystApprovalAction<DependsOn>["Configuration"],
		CodeCatalystApprovalAction<DependsOn>["Configuration"],
		{
			DependsOn: CodeCatalystApprovalAction<DependsOn>["DependsOn"];
		}
	>("aws/approval@v1", undefined);

	if (configuration) {
		factory.setConfiguration({
			ApprovalsRequired: configuration.approvalsRequired,
		});
	}

	if (dependsOn) {
		factory.setRest({
			DependsOn: dependsOn,
		});
	}

	return factory;
};
