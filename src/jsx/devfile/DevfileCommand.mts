import { DevfileCommandBuilder } from "../../ci/cd/pipeline/devfile/DevfileCommand.mts";

export type DevfileCommandProps<Id extends string> = {
	id: Id;
	exec: {
		component: string;
		commandLine: string;
		workingDir?: string;
	};
};

export const DevfileCommand = <Id extends string>(
	props: DevfileCommandProps<Id>,
): DevfileCommandBuilder<Id> => {
	return new DevfileCommandBuilder<Id>(props.id).setExec(props.exec);
};
