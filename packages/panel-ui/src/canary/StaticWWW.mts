import assert from "node:assert";
import { Canary, PromiseActivity } from "@levicape/paloma";
import { LoggingContext } from "@levicape/paloma/runtime/server/RuntimeContext";
import { withStructuredLogging } from "@levicape/paloma/runtime/server/loglayer/LoggingContext";
import { Context, Effect } from "effect";
import { PanelWeb } from "./Atlas.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withContext({
					$event: "main",
				}),
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "Canary" })),
	),
);

trace
	?.withMetadata({
		PanelWeb,
	})
	.info("Loaded service clients");

export const healthcheck = new Canary(
	"http-healthcheck",
	{},
	new PromiseActivity(
		{
			events: {
				enter: async () => {
					const now = Date.now();
					trace
						.withMetadata({
							PromiseActivity: {
								now,
							},
						})
						.info("enter");
					return {
						now,
					};
				},
				exit: async ({ events }) => {
					trace
						.withMetadata({
							PromiseActivity: {
								now: events?.enter,
							},
						})
						.info("exit");
				},
			},
		},
		async ({ events }) => {
			trace.warn("Hello world");
			trace.metadataOnly([events, PanelWeb["/"].url()]);
			{
				const response = await fetch(PanelWeb["/"].url());
				const json = await response.text();
				trace.withMetadata({ json }).info("Fetched");
				assert(response.ok, `Response not ok: ${response.status}`);
			}
		},
	),
);

export const handler = healthcheck;
