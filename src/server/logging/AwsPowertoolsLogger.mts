import { LogLevel, Logger } from "@aws-lambda-powertools/logger";
import { PowertoolsTransport } from "@loglayer/transport-aws-lambda-powertools";
import { Context, Effect } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { env } from "std-env";
import { LoggingContext, LogstreamPassthrough } from "./LoggingContext.mjs";
import {
	$$_spanId_$$,
	$$_traceId_$$,
	LoggingPlugins,
} from "./LoggingPlugins.mjs";

let logLevel: (typeof LogLevel)[keyof typeof LogLevel];
try {
	logLevel = Number(env.LOG_LEVEL ?? "3") >= 3 ? LogLevel.INFO : LogLevel.DEBUG;
} catch (e) {
	logLevel = "INFO";
}

const rootloglayer = Effect.sync(() => {
	const rootId = $$_traceId_$$();
	return new LogLayer({
		transport: new PowertoolsTransport({
			logger: new Logger({
				// TODO: Stack env vars, add to protocol stands
				serviceName: env.AWS_CLOUDMAP_SERVICE_NAME ?? env.PULUMI__NAME,
				logLevel,
			}),
		}),
		errorSerializer: serializeError,
		plugins: LoggingPlugins,
	}).withContext({
		_$span: "root",

		rootId,
		traceId: rootId,
	});
});

export const withAwsPowertoolsLogger = (props: {
	prefix: string;
	context?: Record<string, unknown>;
}) =>
	Context.add(LoggingContext, {
		props,
		logger: Effect.gen(function* () {
			const logger = yield* yield* Effect.cached(rootloglayer);
			const loggerId = $$_spanId_$$();
			let child = props.prefix
				? logger.withPrefix(props.prefix)
				: logger.child();
			const loglayer = child.withContext({
				...props.context,
				_$span: "logger",
				loggerId,
				spanId: loggerId,
			});

			loglayer.debug(`logger span`);

			return loglayer;
		}),
		stream: LogstreamPassthrough,
	});
