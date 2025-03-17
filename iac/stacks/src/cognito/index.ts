import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { IdentityPool } from "@pulumi/aws/cognito";
import { all, interpolate } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import { RandomId } from "@pulumi/random/RandomId";
import type { z } from "zod";
import { $deref } from "../Stack";
import {
	FourtwoApplicationRoot,
	FourtwoApplicationStackExportsZod,
} from "../application/exports";
import { FourtwoCognitoStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/fourtwo";
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

	const identityPoolId = new RandomId(_("identitypool-id"), {
		byteLength: 4,
	});
	const identityPoolName = _("identitypool").replace(/[^a-zA-Z0-9_]/g, "-");
	const identityPool = new IdentityPool(_("identitypool"), {
		identityPoolName: interpolate`${identityPoolName}-${identityPoolId.hex}`,
		tags: {
			Name: _("identitypool"),
			PackageName: PACKAGE_NAME,
		},
	});

	// Helper function to create a User Pool
	// const createUserPool = async (name: string, config: any) => {
	// 	const userPool = new UserPool(_(`userpool-${name}`), {
	// 		adminCreateUserConfig: {
	// 			AllowAdminCreateUserOnly: true,
	// 		},
	// 		tags: {
	// 			PackageName: PACKAGE_NAME,
	// 		},
	// 		...config, // Allow for overrides or additional config
	// 	});

	// 	const userPoolClient = new UserPoolClient(_(`userpool-client-${name}`), {
	// 		userPoolId: userPool.id,
	// 	});

	// 	const userPoolDomain = new UserPoolDomain(_(`userpool-domain-${name}`), {
	// 		userPoolId: userPool.id,
	// 		domain: `${name}-org`, // Consider a more robust domain naming strategy
	// 	});

	// 	return { users, client, domain };
	// };

	const identityPoolOutput = all([
		identityPool.arn,
		identityPool.identityPoolName,
		identityPool.id,
		identityPool.supportedLoginProviders,
		identityPool.cognitoIdentityProviders,
		identityPool.developerProviderName,
		identityPool.openidConnectProviderArns,
		identityPool.samlProviderArns,
	]).apply(
		([
			arn,
			identityPoolName,
			id,
			supportedLoginProviders,
			cognitoIdentityProviders,
			developerProviderName,
			openidConnectProviderArns,
			samlProviderArns,
		]) => {
			return {
				arn,
				identityPoolName,
				id,
				supportedLoginProviders,
				cognitoIdentityProviders,
				developerProviderName,
				openidConnectProviderArns,
				samlProviderArns,
			};
		},
	);

	return all([identityPoolOutput]).apply(([idpool]) => {
		const exported = {
			fourtwo_cognito_identity_pool: {
				pool: idpool,
			},
		} satisfies z.infer<typeof FourtwoCognitoStackExportsZod>;

		const validate = FourtwoCognitoStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
