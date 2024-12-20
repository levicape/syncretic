import { readFile } from "node:fs/promises";
import { cwd } from "node:process";

export const AwsPrincipalNameFromPackageJson = async ({
	prefix,
}: { prefix: string | undefined }) => {
	const packageJson = JSON.parse(
		await readFile(`${cwd()}/package.json`, "utf8"),
	);

	return (
		(prefix ?? "dev") + (packageJson?.name?.replace(/[^a-zA-Z0-9]/g, "-") ?? "")
	);
};

export const PackageJsonRepositoryName = async () => {
	const packageJson = JSON.parse(
		await readFile(`${cwd()}/package.json`, "utf8"),
	);
	let { repository } = packageJson;
	if (typeof repository === "string") {
		if (repository.startsWith("github:")) {
			return repository.split(":")[1];
		}
	}

	console.dir({
		PrincipalCommand: {
			message: "Repository not found in package.json",
			repository,
		},
	});

	return undefined;
};
