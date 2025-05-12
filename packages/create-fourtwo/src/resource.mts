import type { SpawnSyncReturns } from "node:child_process";
import type { Process } from "std-env";

export type Output = string | Buffer | Promise<string | Buffer>;
export interface TemplateResource {
	name: string;
	files: Generator<{} | {}, SpawnSyncReturns<string>, File>;

	post: Generator<{} | {}, SpawnSyncReturns<string>, Output>;
}

// export const JsxPragmaResource = (files: TemplateResource['files']): TemplateResource['post'] => {
// 	return async function* () {
// 		yield {};
// 	}
// }

// PackageJsonFourtwoVersion
