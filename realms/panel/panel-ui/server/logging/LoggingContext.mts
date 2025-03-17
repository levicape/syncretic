import { Context, type Effect } from "effect";
import type { ILogLayer } from "loglayer";
import { env, isCI, isProduction } from "std-env";
import { withAwsPowertoolsLogger } from "./AwsPowertoolsLogger.mjs";
import { withConsolaLogger } from "./ConsolaLogger.mjs";

export type LoggingContextProps = {
	readonly prefix?: string;
	readonly context?: Record<string, unknown>;
};

export class LoggingContext extends Context.Tag("LoggingContext")<
	LoggingContext,
	{
		readonly props: LoggingContextProps;
		readonly logger: Effect.Effect<ILogLayer, unknown>;
	}
>() {}

export const withStructuredLogging = (props: {
	prefix?: string;
	context?: Record<string, unknown>;
}) => {
	const ci = isCI;
	const production = isProduction;
	const supress = ci || production;
	if (
		env.AWS_LAMBDA_FUNCTION_NAME ||
		env.STRUCTURED_LOGGING === "awspowertools"
	) {
		return withAwsPowertoolsLogger({
			...props,
			supress,
		});
	}

	return withConsolaLogger({
		...props,
		supress,
	});
};
