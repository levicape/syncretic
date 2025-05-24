import VError from "verror";

export type DevfileEvent<Id extends string> = {
	postStart: NoInfer<Id>[];
};

export class DevfileEventBuilder<Id extends string> {
	private postStart: DevfileEvent<Id>["postStart"];

	setPostStart(postStart: NoInfer<Id>[]): this {
		this.postStart = postStart;
		return this;
	}

	build() {
		this.postStart.forEach((id) => {
			if (id.includes(" ")) {
				throw new VError("Id cannot contain spaces");
			}

			if (id.match(/[^a-zA-Z0-9-]/)) {
				throw new VError(
					"Id can only contain alphanumeric characters and hyphens",
				);
			}
		});
		return { postStart: this.postStart };
	}
}
