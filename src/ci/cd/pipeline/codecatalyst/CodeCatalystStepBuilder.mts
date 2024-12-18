export type CodeCatalystStep = {
	Run: string;
};

export class CodeCatalystStepBuilder {
	private run: string;

	constructor(run: string) {
		this.run = run;
	}

	build(): CodeCatalystStep {
		return {
			Run: this.run,
		};
	}
}

export const CodeCatalystStepX = (run: string): CodeCatalystStepBuilder => {
	const factory = new CodeCatalystStepBuilder(run);
	return factory;
};
