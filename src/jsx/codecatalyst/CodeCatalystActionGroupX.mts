import VError from "verror";
import type {
	CodeCatalystActionBuilder,
	CodeCatalystActionGroupPart,
} from "../../ci/cd/pipeline/codecatalyst/CodeCatalystActionBuilder.mjs";

export type CodeCatalystActionGroupXProps<
	Identifiers extends string,
	ParentDependsOn extends string,
	DependsOn extends string,
> = {
	dependsOn?: ParentDependsOn[];
	children?: Record<
		DependsOn,
		CodeCatalystActionBuilder<
			Identifiers,
			DependsOn,
			string,
			Partial<Record<string, unknown>>,
			Partial<Record<string, unknown>>
		>
	>;
};

export const CodeCatalystActionGroupX = <
	Identifiers extends string,
	ParentDependsOn extends string,
	DependsOn extends string,
>(
	props: CodeCatalystActionGroupXProps<Identifiers, ParentDependsOn, DependsOn>,
): CodeCatalystActionGroupPart<Identifiers, ParentDependsOn, DependsOn> => {
	const { children } = props;

	if (!children || Object.keys(children).length === 0) {
		throw new VError("At least one action is required");
	}

	let actions = [];
	for (const [name, action] of Object.entries(children) as [
		string,
		CodeCatalystActionBuilder<
			Identifiers,
			DependsOn | ParentDependsOn,
			string,
			Partial<Record<string, unknown>>,
			Partial<Record<string, unknown>>
		>,
	][]) {
		action.setId(name);
		actions.push(action);
	}

	return {
		$$kind: "group",
		$id: "some-id" as ParentDependsOn,
		actions,
		dependsOn: props.dependsOn,
	};
};
