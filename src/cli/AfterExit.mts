// TODO: tseffect
export const AfterExit = {
	commands: [] as (() => void)[],
	execute(fn: () => void) {
		this.commands.push(fn);
	},
};
