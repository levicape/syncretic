export class GithubExecutionCommands {
	static setOutput = (
		name: string,
		value: string,
		props?: {
			commandPrefix?: string;
		},
	): string => {
		const { commandPrefix = "echo" } = props || {};
		return `${commandPrefix} "::set-output name=${name}::${value}"`;
	};
}
