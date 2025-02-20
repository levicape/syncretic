/**
 * Configures the location, project name and stack name of the Pulumi stacks
 */
export const CODECATALYST_PULUMI_STACKS: Array<{
	/**
	 * Path to stack from "iac/stacks" directory
	 */
	stack: string;
	/**
	 * Name of the stack for use in pulumi
	 */
	name?: string;
	/**
	 * Root name for the full stack name, defaults to APPLICATION
	 */
	root?: string;
	/**
	 * The name of the stack for use in output shell exports. Automatically derived from the stack name if not provided
	 */
	output: string;
}> = [
	// {
	// 	stack: "application",
	// },
	{
		stack: "codestar",
	},
	{
		stack: "datalayer",
	},
	{
		stack: "domains/panel/http",
		name: "panel-http",
	},
	{
		stack: "domains/panel/web",
		name: "panel-web",
	},
	{
		stack: "domains/panel/monitor",
		name: "panel-monitor",
	},
	// {
	// 	stack: "wwwroot",
	// },
].map((stack) => ({ ...stack, output: stack.stack.replaceAll("/", "_") }));
