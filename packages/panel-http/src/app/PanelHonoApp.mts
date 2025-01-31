import {
	HonoHttpApp,
	HonoHttpMiddlewareStandard,
	HonoHttpServerApp,
	HonoHttpServerBuilder,
} from "@levicape/spork/router/hono";
import {
	Jwt,
	JwtLayer,
	LoggingContext,
	withStructuredLogging,
} from "@levicape/spork/server";
import { Context, Effect, pipe } from "effect";
import type { Effect as IEffect } from "effect/Effect";
import { Hono } from "hono";

type SporkHonoApp = IEffect.Success<ReturnType<typeof HonoHttpApp>>;

export const server = HonoHttpServerBuilder({
	app: pipe(
		Effect.provide(
			Effect.provide(
				Effect.gen(function* () {
					const consola = yield* LoggingContext;
					const logger = yield* consola.logger;
					const { jwtTools } = yield* Jwt;
					return yield* Effect.flatMap(
						HonoHttpApp({
							middleware: HonoHttpMiddlewareStandard({
								logger,
								jwtTools,
							}),
						}),
						(app) =>
							Effect.succeed(
								app.route(
									"/",
									(new Hono() as SporkHonoApp).get(async (c) => {
										return c.json({ message: "Hello, World!" });
									}),
								),
							),
					);
				}),
				JwtLayer,
			),
			Context.empty().pipe(withStructuredLogging({ prefix: "APP" })),
		),
	),
});

export const app = HonoHttpServerApp(server);
