// Command
export type DevfileCommand<Id extends string> = {
	id: Id;
	exec: {
		component: string;
		commandLine: string;
		workingDir?: string;
	};
};

export class DevfileCommandBuilder<Id extends string> {
	private exec: DevfileCommand<Id>["exec"];

	constructor(private id: Id) {}

	setId(id: Id): this {
		this.id = id;
		return this;
	}

	setExec(exec: DevfileCommand<Id>["exec"]): this {
		this.exec = exec;
		return this;
	}

	build() {
		return { id: this.id, exec: this.exec };
	}
}
