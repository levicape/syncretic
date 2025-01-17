import VError from "verror";

export type CodeDeployAppspecVersion = "0.0";

export type CodeDeployAppspecResourceLambda = {
	Type: "AWS::Lambda::Function";
	Properties: {
		Name: string;
		Alias: string;
		CurrentVersion: string;
		TargetVersion: string;
	};
};

export type CodeDeployAppspecResource = CodeDeployAppspecResourceLambda;

export class CodeDeployAppspecResourceBuilder {
	private _type: CodeDeployAppspecResource["Type"];
	private properties: CodeDeployAppspecResource["Properties"];

	constructor() {
		this._type = "AWS::Lambda::Function";
		this.properties = {
			Name: "",
			Alias: "",
			CurrentVersion: "",
			TargetVersion: "",
		};
	}

	setName(name: string) {
		this.properties.Name = name;
		return this;
	}

	setAlias(alias: string) {
		this.properties.Alias = alias;
		return this;
	}

	setCurrentVersion(version: string) {
		this.properties.CurrentVersion = version;
		return this;
	}

	setTargetVersion(version: string) {
		this.properties.TargetVersion = version;
		return this;
	}

	build(): CodeDeployAppspecResource {
		return {
			Type: this._type,
			Properties: this.properties,
		};
	}
}

export type LambdaArn = string;

export type CodeDeployAppspecHook = LambdaArn;

export type CodeDeployAppspec<
	Resource extends string,
	Hook extends string = "BeforeAllowTraffic" | "AfterAllowTraffic",
> = {
	version: CodeDeployAppspecVersion;
	Resources: Array<Record<Resource, CodeDeployAppspecResource>>;
	Hooks?: Array<Record<Hook, CodeDeployAppspecHook>>;
};

export class CodeDeployAppspecBuilder<
	Resource extends string,
	Hook extends string = "BeforeAllowTraffic" | "AfterAllowTraffic",
> {
	private version: CodeDeployAppspecVersion;
	private resources: Array<Record<Resource, CodeDeployAppspecResourceBuilder>>;
	private hooks: Array<Record<Hook, CodeDeployAppspecHook>>;

	constructor() {
		this.version = "0.0";
		this.resources = [];
		this.hooks = [];
	}

	setVersion(version: CodeDeployAppspecVersion) {
		this.version = version;
		return this;
	}

	addResource(resource: Record<Resource, CodeDeployAppspecResourceBuilder>) {
		this.resources.push(resource);
		return this;
	}

	setResources(
		resources: Array<Record<Resource, CodeDeployAppspecResourceBuilder>>,
	) {
		this.resources = resources;
		return this;
	}

	addHook(hook: Record<Hook, CodeDeployAppspecHook>) {
		this.hooks.push(hook);
		return this;
	}

	setHooks(hooks: Array<Record<Hook, CodeDeployAppspecHook>>) {
		this.hooks = hooks;
		return this;
	}

	build(): CodeDeployAppspec<Resource, Hook> {
		const Resources = this.resources.map((resource) => {
			const keys = Object.keys(resource) as Array<Resource>;

			if (keys.length !== 1) {
				throw new VError("Resource must have exactly one key");
			}

			const key = keys[0];
			return {
				[key]: resource[key].build(),
			} as const;
		}) as CodeDeployAppspec<Resource, Hook>["Resources"];

		if (Resources.length === 0) {
			throw new VError("Resources must not be empty");
		}

		const Hooks = this.hooks;

		return {
			version: this.version,
			Resources,
			...(Hooks.length > 0 ? { Hooks } : {}),
		};
	}
}
