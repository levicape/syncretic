import { Canary, PromiseActivity } from "@levicape/paloma";
import {
	LoggingContext,
	withStructuredLogging,
} from "@levicape/spork/server/logging/LoggingContext";
import { Context, Effect } from "effect";
import { hc } from "hono/client";
import { HTTP_ROOT_PATH, PanelHttp } from "../http/Atlas.mjs";
import type { PanelHonoApp } from "../http/HonoApp.mjs";

const client = hc<PanelHonoApp>(PanelHttp[HTTP_ROOT_PATH].url());
const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("canary").withContext({
					$event: "main",
				}),
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "Canary" })),
	),
);

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
			trace.metadataOnly([
				events,
				{ a: 1, b: "Y" },
				client["~"].Fourtwo.Panel.ok.$url({}),
				{ a: "Z", b: 2 },
			]);
			const response = await client["~"].Fourtwo.Panel.ok.$get({});
			const json = await response.json();
			trace.withMetadata({ json }).info("Fetched");
		},
	),
);

export const handler = healthcheck;
