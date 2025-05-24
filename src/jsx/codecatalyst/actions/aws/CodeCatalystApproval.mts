import { CodeCatalystActionBuilder } from "../../../../ci/cd/pipeline/codecatalyst/CodeCatalystActionBuilder.mts";
import type { CodeCatalystApprovalAction } from "../../../../ci/cd/pipeline/codecatalyst/actions/aws/CodeCatalystApprovalAction.mts";

export type CodeCatalystApprovalConfiguration = {
	approvalsRequired: number;
};

export type CodeCatalystApprovalProps<DependsOn extends string> = {
	dependsOn?: DependsOn[];
	configuration: CodeCatalystApprovalConfiguration;
};

export const CodeCatalystApproval = <DependsOn extends string>(
	props: CodeCatalystApprovalProps<DependsOn>,
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
