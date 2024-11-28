export type DomainRegistry = "docker" | "ghcr" | "ecr-public";
export interface DomainRegistryCredential {
	username: string;
	accessToken: string;
}
export interface DomainRegistryCredentials
	extends Record<
		Exclude<DomainRegistry, "ecr-public">,
		DomainRegistryCredential | undefined
	> {}
