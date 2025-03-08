import { Context, type Effect } from "effect";
import type { ILogLayer } from "loglayer";
import { env } from "std-env";
import { withAwsPowertoolsLogger } from "./AwsPowertoolsLogger.mjs";
import { withConsolaLogger } from "./ConsolaLogger.mjs";
import { withPinoLogger } from "./PinoLogger.mjs";
import { withQuietLogger } from "./QuietLogger.mjs";
import type { LoggingConfig } from "./config/LoggingConfig.mjs";
import type { LoggingConfigAws } from "./config/LoggingConfigAws.mjs";

export type LoggingContextProps = {
	readonly prefix: string;
	readonly context?: Record<string, unknown>;
};

/**
 * LoggingContext provides logging functionalities.
 * @see LoggingConfig
 * @see LoggingConfigAws
 */
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

/**
 * LogstreamPassthrough is a utility function that allows logging messages
 * through a provided logger and a custom each function. LoggingContext instances use this by default for stream() calls
 *
 * @param logger - The logger instance to use for logging.
 * @param each - A function that takes a logger and a message to log.
 * @returns A function that takes a message and logs it, then returns the message.
 */
export const LogstreamPassthrough =
	(logger: ILogLayer, each: (logger: ILogLayer, message: string) => void) =>
	(m: string) => {
		each(logger, m);
		return m;
	};

/**
 * Creates a logging context for the current environment with Context.add()
 * @see LoggingConfig
 * @see LoggingConfigAws
 */
export const withStructuredLogging = (props: LoggingContextProps) => {
	const { STRUCTURED_LOGGING } = env as unknown as LoggingConfig;
	const { AWS_LAMBDA_FUNCTION_NAME } = env as unknown as LoggingConfigAws;

	if (AWS_LAMBDA_FUNCTION_NAME || STRUCTURED_LOGGING === "awspowertools") {
		return withAwsPowertoolsLogger(props);
	}

	if (STRUCTURED_LOGGING === "consola") {
		return withConsolaLogger(props);
	}

	if (STRUCTURED_LOGGING === "quiet") {
		return withQuietLogger(props);
	}

	return withPinoLogger(props);
};

export * from "./AwsPowertoolsLogger.mjs";
export * from "./config/LoggingConfig.mjs";
export * from "./config/LoggingConfigAws.mjs";
export * from "./ConsolaLogger.mjs";
export * from "./LoggingPlugins.mjs";
export * from "./PinoLogger.mjs";
export * from "./plugins/DurationPlugin.mjs";
export * from "./plugins/OtelLogPlugin.mjs";
export * from "./plugins/UnixtimeLogPlugin.mjs";
export * from "./QuietLogger.mjs";
