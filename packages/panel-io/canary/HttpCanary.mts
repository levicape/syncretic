import { Canary, PromiseActivity } from "@levicape/paloma";
import {
	LoggingContext,
	RuntimeContext,
} from "@levicape/paloma/runtime/server/RuntimeContext";
import { Effect } from "effect";

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
		RuntimeContext,
	),
);

export const healthcheck = new Canary(
	"httpcanary-healthcheck",
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
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			fetch("https://jsonplaceholder.typicode.com/todos/1")
				.then((response) => response.json())
				.then((json) => {
					trace.withMetadata({ json }).info("Fetched");
				});
		},
	),
);