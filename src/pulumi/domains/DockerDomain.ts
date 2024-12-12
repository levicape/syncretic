import { execSync } from "node:child_process";

export type DockerDomainInfo = {
	architecture: string;
	os: string;
};

export class DockerDomain {
	static async getInfo(): Promise<DockerDomainInfo> {
		const dockerInfoArchitecture = execSync(
			"docker info --format '{{.Architecture}}'",
			{ encoding: "utf-8" },
		).trim();
		const architecture =
			dockerInfoArchitecture === "aarch64" ? "arm64" : dockerInfoArchitecture;
		const os = execSync("docker info --format '{{.OSType}}'", {
			encoding: "utf-8",
		}).trim();

		return {
			architecture,
			os,
		};
	}
}
