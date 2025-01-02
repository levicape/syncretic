/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import { PulumiStateAws } from "@levicape/fourtwo-pulumi";
export = async () => {
	const bucket = new PulumiStateAws("fourtwo:aws:bootstrap", {});

	return {
		...bucket,
		bucket: undefined,
	};
};
