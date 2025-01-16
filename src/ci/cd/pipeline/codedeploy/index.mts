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
	Hooks: Array<Record<Hook, CodeDeployAppspecHook>>;
};
