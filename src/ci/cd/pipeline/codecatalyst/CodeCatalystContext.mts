import type { Target } from "../../target/Target.mjs";

export class CodeCatalystContext {
	/**
	 * @param {Target} target
	 * @returns {Record<string, string | undefined>}
	 */
	static getBuildEnv = (target: Target): Record<string, string | undefined> => {
		const { baseline, abi } = target;
		return {
			ENABLE_BASELINE: baseline ? "ON" : "OFF",
			ABI: abi === "musl" ? "musl" : undefined,
		};
	};

	/**
	 * @param {string} text
	 * @returns {string}
	 * @link https://github.com/buildkite/emojis#emoji-reference
	 */
	static getEmoji = (text: string): string => {
		if (text === "amazonlinux") {
			return ":aws:";
		}
		return `:${text}:`;
	};
}
