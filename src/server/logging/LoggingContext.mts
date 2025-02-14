import { Context, type Effect } from "effect";
import type { ILogLayer } from "loglayer";
import { env } from "std-env";
import { withAwsPowertoolsLogger } from "./AwsPowertoolsLogger.mjs";
import { withConsolaLogger } from "./ConsolaLogger.mjs";
import { withPinoLogger } from "./PinoLogger.mjs";

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
	const { AWS_LAMBDA_FUNCTION_NAME, STRUCTURED_LOGGING } = env;

	if (AWS_LAMBDA_FUNCTION_NAME || STRUCTURED_LOGGING === "awspowertools") {
		return withAwsPowertoolsLogger(props);
	}

	if (STRUCTURED_LOGGING === "consola") {
		return withConsolaLogger(props);
	}

	return withPinoLogger(props);
};
