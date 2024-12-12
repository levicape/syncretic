import { ResourcePolicy, type Table } from "@pulumi/aws/dynamodb/index.js";
import type { PolicyDocument } from "@pulumi/aws/iam/documents.js";
import type { Role } from "@pulumi/aws/iam/role.js";
import type { Region } from "@pulumi/aws/index.js";
import {
	type ComponentResource,
	type Output,
	all,
	interpolate,
	jsonStringify,
} from "@pulumi/pulumi/index.js";

export class AwsDynamoDbTable {
	static GSI_NAME_REGEX = /__(.*)__/;
	static getGsiMap = (
		indexes: ReturnType<Table["globalSecondaryIndexes"]["get"]>,
	): Record<string, string> => {
		const map: Record<string, string> = {};
		if (indexes) {
			for (const { name } of indexes) {
				const gsi = AwsDynamoDbTable.GSI_NAME_REGEX.exec(name)?.[1];
				if (gsi !== undefined) {
					let envSafeName = name.replace(/-/g, "_");
					envSafeName = envSafeName.replace(/\./g, "_");
					envSafeName = envSafeName.toUpperCase();
					map[envSafeName] = name;
				}
			}
		}
		return map;
	};

	static jvm() {
		return {
			LEAF_APPLICATION_DYNAMODB_ENABLED: `true`,
		} as Record<string, string>;
	}

	static environmentVariables<T extends string>(
		prefix: T,
		region: Region,
		table: Table,
	): Output<Record<`${T}__${string}`, string>> {
		return all([table.name, table.globalSecondaryIndexes]).apply(
			([name, indexes]) => {
				console.debug({
					AwsDynamoDbTable: {
						name,
						prefix,
						region,
						indexes,
					},
				});
				return {
					...AwsDynamoDbTable.jvm(),
					[`${prefix}__NAME`]: `dynamodb://${name}`,
					[`${prefix}__REGION`]: region,
					...(Object.fromEntries(
						Object.entries(AwsDynamoDbTable.getGsiMap(indexes)).map(
							([gsi, name]) => [
								`${prefix}__INDEX_${gsi}` satisfies `${T}__${string}`,
								name,
							],
						),
					) as Record<`${T}__${string}`, string>),
				} satisfies Record<`${T}__${string}`, string>;
			},
		);
	}

	static resourcePolicy = (
		parent: ComponentResource<unknown>,
		tableResourceName: string,
		tables: Array<[string, Table]>,
		role: Role,
	): Array<ResourcePolicy> => {
		return tables.flatMap(([tableName, table]) => [
			new ResourcePolicy(
				`${tableResourceName}-${tableName}-resource-policy`,
				{
					resourceArn: table.arn,
					policy: jsonStringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Principal: {
									AWS: interpolate`${role.arn}`,
								},
								Action: ["dynamodb:*"],
								Resource: table.arn.apply((arn) => {
									return [arn, `${arn}/index/*`];
								}),
							},
						],
					} satisfies PolicyDocument),
				},
				{ parent },
			),
			new ResourcePolicy(
				`${tableResourceName}-${tableName}-streams-resource-policy`,
				{
					resourceArn: table.streamArn,
					policy: jsonStringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Principal: {
									AWS: interpolate`${role.arn}`,
								},
								Action: ["dynamodb:*"],
								Resource: interpolate`${table.streamArn}`,
							},
						],
					} satisfies PolicyDocument),
				},
				{ parent },
			),
		]);
	};
}
