/*
 ** Reserved for future use
 */
export type CodePipelineBlocker = {
	name: string; // Builder validation: Minimum 1 character, Maximum 100 characters. Regex: ^[A-Za-z0-9_-]+$
	type: "SCHEDULE";
};
export interface CodePipelineBlockerBuilder {
	setName(name: string): this;
	setType(type: unknown): this;
	build(): CodePipelineBlocker;
}
/*
 **
 */
