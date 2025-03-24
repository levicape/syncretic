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
	{
		stack: "application",
	},
	{
		stack: "codestar",
	},
	{
		stack: "identity/oidc",
		name: "identity-oidc",
	},
	{
		stack: "identity/users",
		name: "identity-users",
	},
	{
		stack: "datalayer",
	},
	{
		stack: "dns/root",
		name: "dns-root",
	},
	{
		stack: "levicape/panel/channels",
		name: "panel-channels",
	},
	{
		stack: "levicape/panel/client",
		name: "panel-client",
	},
	{
		stack: "levicape/panel/http",
		name: "panel-http",
	},
	{
		stack: "levicape/panel/web",
		name: "panel-web",
	},
	{
		stack: "levicape/panel/monitor",
		name: "panel-monitor",
	},
	{
		stack: "levicape/panel/wwwroot",
		name: "panel-wwwroot",
	},
].map((stack) => ({ ...stack, output: stack.stack.replaceAll("/", "_") }));
