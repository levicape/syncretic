import { Context } from "@levicape/fourtwo-pulumi";
import { CostAllocationTag } from "@pulumi/aws/costexplorer/costAllocationTag";
import { Group } from "@pulumi/aws/resourcegroups";
import { AppregistryApplication } from "@pulumi/aws/servicecatalog";
import { all } from "@pulumi/pulumi";
import type { z } from "zod";
import { FourtwoApplicationStackExportsZod } from "./exports";

export = async () => {
	const context = await Context.fromConfig({});
	const _ = (name: string) => `${context.prefix}-${name}`;

	const servicecatalog = (() => {
		return { application: new AppregistryApplication(_("servicecatalog"), {}) };
	})();

	const costexplorer = (() => {
		return {
			allocation: {
				tag: new CostAllocationTag(_(""), {
					status: "Active",
					tagKey: Context._PREFIX_TAG,
				}),
			},
		};
	})();

	// const resourcegroups = (() => {
	// 	const group = (
	// 		name: string,
	// 		props: {
	// 			resourceQuery: {
	// 				type: string;
	// 				query: string;
	// 			};
	// 		},
	// 	) => {
	// 		return {
	// 			group: new Group(_(name), props),
	// 		};
	// 	};
	// 	return {
	// 		stack: group("stack", {
	// 			resourceQuery: {
	// 				type: "TAG_FILTERS_1_0",
	// 				query: JSON.stringify({
	// 					ResourceTypeFilters: ["AWS::AllSupported"],
	// 					TagFilters: [
	// 						{ Key: Context._PREFIX_TAG, Values: [context.prefix] },
	// 					],
	// 				}),
	// 			},
	// 		}),
	// 		data: group("data", {
	// 			resourceQuery: {
	// 				type: "TAG_FILTERS_1_0",
	// 				query: JSON.stringify({
	// 					ResourceTypeFilters: [
	// 						"AWS::ElasticFileSystem::FileSystem",
	// 						"AWS::S3::Bucket",
	// 						"AWS::DynamoDB::Table",
	// 					],
	// 					TagFilters: [
	// 						{ Key: Context._PREFIX_TAG, Values: [context.prefix] },
	// 					],
	// 				}),
	// 			},
	// 		}),
	// 		lambda: group("lambda", {
	// 			resourceQuery: {
	// 				type: "TAG_FILTERS_1_0",
	// 				query: JSON.stringify({
	// 					// Include EFS, VPC
	// 					ResourceTypeFilters: [
	// 						"AWS::Lambda::Function",
	// 						"AWS::VPC::VPC",
	// 						"AWS::VPC::Subnet",
	// 					],
	// 					TagFilters: [
	// 						{ Key: Context._PREFIX_TAG, Values: [context.prefix] },
	// 					],
	// 				}),
	// 			},
	// 		}),
	// 		dns: group("dns", {
	// 			resourceQuery: {
	// 				type: "TAG_FILTERS_1_0",
	// 				query: JSON.stringify({
	// 					ResourceTypeFilters: [
	// 						"AWS::CloudFront::Distribution",
	// 						"AWS::Route53::HostedZone",
	// 					],
	// 					TagFilters: [
	// 						{ Key: Context._PREFIX_TAG, Values: [context.prefix] },
	// 					],
	// 				}),
	// 			},
	// 		}),
	// 	};
	// })();

	return all([
		servicecatalog.application.arn,
		servicecatalog.application.id,
		servicecatalog.application.name,
		costexplorer.allocation.tag.status,
		costexplorer.allocation.tag.tagKey,
		costexplorer.allocation.tag.type,
		// all(
		// 	Object.entries(resourcegroups).map(([name, group]) => {
		// 		return all([
		// 			name,
		// 			group.group.arn,
		// 			group.group.name,
		// 			group.group.id,
		// 			group.group.resourceQuery,
		// 		]).apply(([name, groupArn, groupName, groupId]) => {
		// 			return {
		// 				arn: groupArn,
		// 				name: groupName,
		// 				id: groupId,
		// 			};
		// 		});
		// 	}),
		// ).apply((groups) => {
		// 	return Object.fromEntries(
		// 		Object.entries(groups).map(([name, group]) => {
		// 			return [
		// 				name,
		// 				{
		// 					arn: group.arn,
		// 					name: group.name,
		// 					id: group.id,
		// 				},
		// 			];
		// 		}),
		// 	);
		// }),
	]).apply(
		([
			applicationArn,
			applicationId,
			applicationName,
			costAllocationTagStatus,
			costAllocationTagKey,
			costAllocationTagType,
			// resourcegroups,
		]) => {
			const exported = {
				fourtwo_application_servicecatalog: {
					application: {
						arn: applicationArn,
						id: applicationId,
						name: applicationName,
					},
				},
				fourtwo_application_costexplorer: {
					allocation: {
						$kind: "tag",
						tag: {
							status: costAllocationTagStatus,
							key: costAllocationTagKey,
							type: costAllocationTagType,
						},
					},
				},
				// fourtwo_application_resourcegroups: resourcegroups,
			} satisfies z.infer<typeof FourtwoApplicationStackExportsZod>;

			const validate = FourtwoApplicationStackExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}
			return exported;
		},
	);
};
