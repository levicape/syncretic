import { Context, Effect, pipe } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { LoggingContext, LogstreamPassthrough } from "./LoggingContext.mjs";
import {
	$$_spanId_$$,
	$$_traceId_$$,
	LoggingPlugins,
} from "./LoggingPlugins.mjs";
import { LoggingConfigMain } from "./config/LoggingConfig.mjs";

const rootloglayer = pipe(
	LoggingConfigMain,
	Effect.flatMap(({ isDebug }) =>
		Effect.sync(() => {
			const rootId = $$_traceId_$$();
			return new LogLayer({
				enabled: false,
				transport: new (class NoopTransport {
					/**
					 * A user-defined identifier for the transport
					 **/
					id?: string;
					/**
					 * If false, the transport will not send logs to the logger.
					 * Default is true.
					 */
					enabled?: boolean;
					/**
					 * Sends the log data to the logger for transport
					 */
					shipToLogger(params: unknown): unknown[] {
						return [];
					}
					/**
					 * Internal use only. Do not implement.
					 * @param params
					 */
					_sendToLogger(params: unknown): void {}
					/**
					 * Returns the logger instance attached to the transport
					 */
					getLoggerInstance(): unknown {
						return {};
					}
				})(),
				errorSerializer: serializeError,
				plugins: LoggingPlugins,
			}).withContext({
				_$span: "root",
				rootId,
				traceId: rootId,
			});
		}),
	),
);

export const withQuietLogger = (props: {
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
