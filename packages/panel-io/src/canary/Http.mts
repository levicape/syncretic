import { Canary, PromiseActivity } from "@levicape/paloma";
import { LoggingContext } from "@levicape/paloma/runtime/server/RuntimeContext";
import { Effect } from "effect";
import { hc } from "hono/client";
import type { PanelHonoApp } from "../http/HonoApp.mjs";
import { PanelHttp } from "./Atlas.mjs";

const client = hc<PanelHonoApp>(PanelHttp["/~/v1/Fourtwo/Panel"].url());
const { Panel } = client["~"].v1.Fourtwo;
const { trace } = await Effect.runPromise(
	// @ts-ignore
	Effect.provide(
		// @ts-ignore
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("canary").withContext({
					$event: "main",
				}),
			};
		}),
		// @ts-ignore
		Context.empty().pipe(withStructuredLogging({ prefix: "Canary" })),
	),
);

trace
	.withMetadata({
		Panel,
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
			trace.metadataOnly([
				events,
				{ a: 1, b: "Y" },
				Panel.ok.$url({}),
				{ a: "Z", b: 2 },
			]);
			const response = await Panel.ok.$get({});
			const json = await response.json();
			trace.withMetadata({ json }).info("Fetched");
		},
	),
);

export const handler = healthcheck;
