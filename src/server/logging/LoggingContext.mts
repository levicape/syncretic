import { Context, type Effect } from "effect";
import type { ILogLayer } from "loglayer";
import { env } from "std-env";
import { withAwsPowertoolsLogger } from "./AwsPowertoolsLogger.mjs";
import { withConsolaLogger } from "./ConsolaLogger.mjs";

export type LoggingContextProps = {
	readonly prefix: string;
	readonly context?: Record<string, unknown>;
};

export class LoggingContext extends Context.Tag("LoggingContext")<
	LoggingContext,
	{
		readonly props: LoggingContextProps;
		readonly logger: Effect.Effect<ILogLayer, unknown>;
		readonly stream: (
			logger: ILogLayer,
			each: (logger: ILogLayer, message: string) => void,
		) => (m: string) => string;
	}
>() {}

export const LogstreamPassthrough =
	(logger: ILogLayer, each: (logger: ILogLayer, message: string) => void) =>
	(m: string) => {
		each(logger, m);
		return m;
	};

export const withStructuredLogging = (props: LoggingContextProps) => {
	if (
		env.AWS_LAMBDA_FUNCTION_NAME ||
		env.STRUCTURED_LOGGING === "awspowertools"
	) {
		return withAwsPowertoolsLogger(props);
	}

	return withConsolaLogger(props);
};
