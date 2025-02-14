import { ConsolaTransport } from "@loglayer/transport-consola";
import { createConsola } from "consola";
import { Context, Effect } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { env } from "std-env";
import { ulid } from "ulidx";
import { LoggingContext } from "./LoggingContext.mjs";

const rootloglayer = Effect.succeed(
	new LogLayer({
		transport: new ConsolaTransport({
			logger: createConsola({
				formatOptions: {
					compact: false,
				},
				level: Number(env.LOG_LEVEL ?? "3"),
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

export const withConsolaLogger = (props: {
	context?: Record<string, unknown>;
	prefix?: string;
	supress?: boolean;
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
