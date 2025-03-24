import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Topic, type TopicArgs } from "@pulumi/aws/sns/topic";
import { error, warn } from "@pulumi/pulumi/log";
import { Output, all } from "@pulumi/pulumi/output";
import type { z } from "zod";
import { objectEntries, objectFromEntries } from "../../../Object";
import { $deref } from "../../../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../../../application/exports";
import { FourtwoPanelWWWRootSubdomain } from "../wwwroot/exports";
import { FourtwoPanelChannelsStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo" as const;
const SUBDOMAIN =
	process.env["STACKREF_SUBDOMAIN"] ?? FourtwoPanelWWWRootSubdomain;

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? FourtwoApplicationRoot;
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		application: {
			refs: {
				servicecatalog:
					FourtwoApplicationStackExportsZod.shape
						.fourtwo_application_servicecatalog,
			},
		},
	},
};

export = async () => {
	// Stack references
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	// Resources
	const sns = (() => {
		const topic = (name: string, args: TopicArgs) => {
			return new Topic(_(`topic-${name}`), {
				tags: {
					PackageName: PACKAGE_NAME,
					StackRef: STACKREF_ROOT,
					Subdomain: SUBDOMAIN,
				},
			});
		};
		return {
			revalidate: topic("revalidate", {
				displayName: `${context.prefix} - revalidate (${PACKAGE_NAME})`,
			}),
		};
	})();

	const snsOutput = Output.create(
		objectFromEntries(
			objectEntries(sns).map(([key, value]) => [
				key,
				all([value.arn, value.id, value.name]).apply(([arn, id, name]) => ({
					topic: {
						arn,
						id,
						name,
					},
				})),
			]),
		),
	);

	return all([snsOutput]).apply(([sns]) => {
		const exported = {
			fourtwo_panel_channels_sns: sns,
		} satisfies z.infer<typeof FourtwoPanelChannelsStackExportsZod>;

		const validate = FourtwoPanelChannelsStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
