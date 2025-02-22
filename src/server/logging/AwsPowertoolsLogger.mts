import { LogLevel, Logger } from "@aws-lambda-powertools/logger";
import { PowertoolsTransport } from "@loglayer/transport-aws-lambda-powertools";
import { Config, Context, Effect, pipe } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { LoggingContext, LogstreamPassthrough } from "./LoggingContext.mjs";
import {
	$$_spanId_$$,
	$$_traceId_$$,
	LoggingPlugins,
} from "./LoggingPlugins.mjs";
import { LoggingConfigMain } from "./config/LoggingConfig.mjs";
import { LoggingConfigAwsMain } from "./config/LoggingConfigAws.mjs";
import { LoggingConfigLevicapeMain } from "./config/LoggingConfigLevicape.mjs";

const rootloglayer = pipe(
	Config.all([
		LoggingConfigMain,
		LoggingConfigAwsMain,
		LoggingConfigLevicapeMain,
	]),
	Effect.flatMap(
		([{ isDebug }, { AWS_CLOUDMAP_SERVICE_NAME }, { PULUMI__NAME }]) =>
			Effect.sync(() => {
				const rootId = $$_traceId_$$();
				const serviceName = AWS_CLOUDMAP_SERVICE_NAME ?? PULUMI__NAME;
				const logLevel = isDebug ? LogLevel.DEBUG : LogLevel.INFO;

				return new LogLayer({
					transport: new PowertoolsTransport({
						logger: new Logger({
							// TODO: Stack env vars, add to protocol stands
							...(serviceName !== undefined
								? {
										serviceName,
									}
								: {}),
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
			}),
	),
);

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
