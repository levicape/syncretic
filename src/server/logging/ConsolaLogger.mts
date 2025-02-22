import { ConsolaTransport } from "@loglayer/transport-consola";
import { createConsola } from "consola";
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
	Effect.flatMap(({ isDebug, LOG_LEVEL }) =>
		Effect.sync(() => {
			const rootId = $$_traceId_$$();

			return new LogLayer({
				transport: new ConsolaTransport({
					logger: createConsola({
						fancy: false,
						formatOptions: {
							compact: false,
						},
						level: isDebug ? 5 : LOG_LEVEL,
					}),
				}),
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

export const withConsolaLogger = (props: {
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
