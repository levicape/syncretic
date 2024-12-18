import { relative } from "node:path";
import ms from "pretty-ms";

export type GenerateWorkflowTemplateProps = {
	cwd: string;
	filename: string;
	source: string;
	yaml: string;
	hashed: string;
	generator: string;
	then: number;
	now: number;
};

export function GenerateWorkflowTemplate(props: GenerateWorkflowTemplateProps) {
	const { cwd, filename, source, yaml, hashed, generator, then, now } = props;
	return `########################################
# THIS FILE WAS AUTOMATICALLY GENERATED, DO NOT MODIFY
########################################
${yaml}
########################################
########################################
#**:_$~- ${JSON.stringify({ $$: "head", filename, source: relative(cwd, source) })}
#**:_$~- ${JSON.stringify({ $$: "script", generator })}
#**:_$~- ${JSON.stringify({ $$: "body", hashed })}
#**:_$~- ${JSON.stringify({ $$: "footer", started: new Date(then).toISOString(), now: new Date(now).toISOString(), elapsed: ms(now - then) })}
# END OF GENERATED FILE

`;
}
