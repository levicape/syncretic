import {
	ComponentResource,
	type ComponentResourceOptions,
	type Output,
} from "@pulumi/pulumi/index.js";
import type { Context } from "../../context/Context.js";
import type { Prefix, Route, Service } from "../website/WebsiteManifest.js";

export interface CdnComponentProps {
	context: Context;
	routes?: Output<Record<Service, Record<Prefix, Route>>>;
	blockPublic?: boolean;
}
export class CdnComponent extends ComponentResource {
	constructor(
		urn: string,
		name: string,
		_: CdnComponentProps,
		opts?: ComponentResourceOptions,
	) {
		super(urn, name, {}, opts);
	}
}
