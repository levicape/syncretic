import type { Region } from "@pulumi/aws";
import type {
	ResourcePolicy as ReourcePolicyType,
	Table,
} from "@pulumi/aws/dynamodb";
import type { PolicyDocument } from "@pulumi/aws/iam";
import type { Role } from "@pulumi/aws/iam";
import type { ComponentResource, Output } from "@pulumi/pulumi";

const { ResourcePolicy } = require("@pulumi/aws/dynamodb");
const { all, interpolate, jsonStringify } = require("@pulumi/pulumi");
class AwsDynamoDbTable {
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
			([name, indexes]: [
				string,
				ReturnType<(typeof table.globalSecondaryIndexes)["get"]>,
			]) => {
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
	): Array<ReourcePolicyType> => {
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
export type { AwsDynamoDbTable };

module.exports = {
	AwsDynamoDbTable,
};
