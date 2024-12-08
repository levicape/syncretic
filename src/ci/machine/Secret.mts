import { executeSync } from "./Execute.mjs";
import { getEnv, setEnv } from "./context/Environment.mjs";
import { isBuildkite } from "./executor/Buildkite.mjs";

export function getSecret(
	name: string,
	options: { required?: boolean; redact?: boolean } = {
		required: true,
		redact: true,
	},
): string {
	const value = getEnv(name, false);
	if (value) {
		return value;
	}

	if (isBuildkite) {
		const command = ["buildkite-agent", "secret", "get", name];
		if (options.redact === false) {
			command.push("--skip-redaction");
		}

		const { error, stdout } = executeSync(command);
		const secret = stdout.trim();
		if (error || !secret) {
			const orgId = getEnv("BUILDKITE_ORGANIZATION_SLUG", false);
			const clusterId = getEnv("BUILDKITE_CLUSTER_ID", false);

			let hint: string;
			if (orgId && clusterId) {
				hint = `https://buildkite.com/organizations/${orgId}/clusters/${clusterId}/secrets`;
			} else {
				hint = "https://buildkite.com/docs/pipelines/buildkite-secrets";
			}

			throw new Error(
				`Secret not found: ${name} (hint: go to ${hint} and create a secret)`,
				{ cause: error },
			);
		}

		setEnv(name, secret);
		return secret;
	}

	return getEnv(name, options.required) ?? "";
}
