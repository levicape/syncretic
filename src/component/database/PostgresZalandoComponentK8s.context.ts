import { all } from "@pulumi/pulumi/output.js";
import type { PostgresZalandoComponentK8s } from "./PostgresZalandoComponentK8s.js";

export function createDatabaseEnvironment<Schema extends string>(
	database: PostgresZalandoComponentK8s<Schema>,
	prefix: string,
) {
	return {
		envs: all([
			database.k8s.services.master.service.name,
			5432,
			database.k8s.services.replica.service.name,
			5432,
		]).apply(
			([
				master_service_name,
				master_service_port,
				replica_service_name,
				replica_service_port,
			]) => {
				const schemas = Object.fromEntries(
					Object.keys(database.k8s.secrets.prepared).map((key, i) => {
						return [`${prefix}_DATABASE__DB_${i}`, key];
					}),
				);
				prefix = prefix.toUpperCase();
				const dbName = Object.keys(database.k8s.secrets.prepared)[0];
				const schema = "public";
				return {
					LEAF_APPLICATION_DYNAMODB_ENABLED: "false",
					[`${prefix}_DATABASE__NAME`]: `postgresql://${master_service_name}:${master_service_port}`,
					[`${prefix}_DATABASE__READ`]: `postgresql://${replica_service_name}:${replica_service_port}`,
					[`${prefix}_DATABASE__HOST`]: `${master_service_name}`,
					[`${prefix}_DATABASE__PORT`]: `${master_service_port}`,
					[`${prefix}_DATABASE__SCHEMA`]: `${schema}`,
					[`${prefix}_DATABASE__JDBC`]: `jdbc:postgresql://${master_service_name}:${master_service_port}/${dbName}?sslmode=require&search_path=${schema}`,
					[`${prefix}_DATABASE__JDBC_DRIVER`]: `org.postgresql.Driver`,
					[`${prefix}_DATABASE__R2DBC`]: `r2dbc:postgresql://${master_service_name}:${master_service_port}/${dbName}?sslmode=require&search_path=${schema}`,
					[`${prefix}_DATABASE__R2DBC_DIALECT`]: `POSTGRES`,
					[`${prefix}_DATABASE__SCHEMAGENERATE`]: `NONE`,
					...schemas,
				} as Record<string, string>;
			},
		),
		envFrom: all([]).apply(() => {
			const roles = (
				Object.keys(database.k8s.secrets.prepared) as Array<
					keyof typeof database.k8s.secrets.prepared
				>
			).flatMap((key, i) => {
				return (["reader", "writer", "owner"] as const).map((role) => {
					prefix = prefix.toUpperCase();
					return {
						prefix: `${prefix}_DATABASE__DB_${i}__${role.toUpperCase()}_`,
						secretRef: {
							name: database.k8s.secrets.prepared[key][role].secret.name,
						},
					};
				});
			});

			return [...roles];
		}),
	};
}
