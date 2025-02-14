import { LogLevel, Logger } from "@aws-lambda-powertools/logger";
import { PowertoolsTransport } from "@loglayer/transport-aws-lambda-powertools";
import { Context, Effect } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { env } from "std-env";
import { ulid } from "ulidx";
import { LoggingContext } from "./LoggingContext.mjs";

let logLevel: (typeof LogLevel)[keyof typeof LogLevel];
try {
	logLevel = Number(env.LOG_LEVEL ?? "3") >= 3 ? LogLevel.INFO : LogLevel.DEBUG;
} catch (e) {
	logLevel = "INFO";
}

const rootloglayer = Effect.succeed(
	new LogLayer({
		transport: new PowertoolsTransport({
			logger: new Logger({
				serviceName: env.AWS_CLOUDMAP_SERVICE_NAME,
				logLevel,
			}),
		}),
		errorSerializer: serializeError,
		plugins: [
			{
				id: "unixtime-plugin",
				onBeforeDataOut: ({ data }) => {
					if (data) {
						data.unixtime = Date.now();
					}
					return data;
				},
			},
		],
	}).withContext({
		rootId: ulid(),
	}),
);

export const withAwsPowertoolsLogger = (props: {
	supress?: boolean;
	prefix?: string;
	context?: Record<string, unknown>;
}) =>
	Context.add(LoggingContext, {
		props,
		logger: Effect.gen(function* () {
			const logger = yield* yield* Effect.cached(rootloglayer);
			const loggerId = ulid().slice(-16);
			let child = props.prefix
				? logger.withPrefix(props.prefix)
				: logger.child();

			if (props.supress) {
				child = child.disableLogging();
			}

			return child.withContext({
				...props.context,
				loggerId,
			});
		}),
	});
