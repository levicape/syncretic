/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

// Organization AWS provider
// Import Parameter for OAA role
// Provider assuming OAA Role
import { PulumiStateAws } from "@levicape/fourtwo-pulumi";
// SSM Parameters

export = async () => {
	const bucket = new PulumiStateAws("fourtwo:aws:bootstrap", {});

	return {
		...bucket,
		bucket: undefined,
	};
};
