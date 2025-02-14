import VError from "verror";

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

	constructor(private id: Id) {
		if (id.includes(" ")) {
			throw new VError("Id cannot contain spaces");
		}

		if (id.match(/[^a-zA-Z0-9-]/)) {
			throw new VError(
				"Id can only contain alphanumeric characters and hyphens",
			);
		}
	}

	setId(id: Id): this {
		this.id = id;
		return this;
	}

	setExec(exec: DevfileCommand<Id>["exec"]): this {
		this.exec = exec;
		return this;
	}

	build() {
		if (!this.exec.commandLine.endsWith(";")) {
			this.exec.commandLine += ";";
		}
		return { id: this.id, exec: this.exec };
	}
}
