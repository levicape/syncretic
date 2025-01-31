#!/usr/bin/env -S NODE_NO_WARNINGS=1 NPM_CONFIG_UPDATE_VERIFIER=false node --import tsx --experimental-strip-types --env-file=.env.development

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Context, Effect } from "effect";
import express from "express";
import type { ILogLayer } from "loglayer";
import {
	env,
	isDevelopment,
	isProduction,
	nodeVersion,
	platform,
	process,
} from "std-env";
import { ulid } from "ulidx";
import { createServer as createViteServer } from "vite";
import {
	LoggingContext,
	withStructuredLogging,
} from "./server/logging/LoggingContext.mjs";

declare global {
	namespace Express {
		interface Request {
			log: ILogLayer;
		}
	}
}

type RenderFunction = (props: { url: string }) => Promise<{
	ssr: {
		head?: string;
		html?: string;
	};
}>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = Effect.gen(function* () {
	const logger = yield* (yield* LoggingContext).logger;
	logger
		.withMetadata({
			isDevelopment,
			isProduction,
			platform,
			process: {
				arch: process.arch,
				argv: process.argv,
				execPath: process.execPath,
				availableMemory: process.availableMemory?.(),
				cwd: process.cwd?.(),
				pid: process.pid,
				uptime: process.uptime?.(),
			},
			nodeVersion,
		})
		.info("Starting server");

	let pathToIndex = path.resolve(env.CLIENT_OUTPUT ?? __dirname, "index.html");
	if (isProduction) {
		if (!env.CLIENT_OUTPUT) {
			logger
				.withMetadata({
					pathToIndex,
					CLIENT_OUTPUT: env.CLIENT_OUTPUT,
				})
				.fatal("No CLIENT_OUTPUT provided");
			process.exit?.(1);
			return;
		}
	}

	let serverEntrypoint = env.SERVER_ENTRYPOINT ?? "";
	if (serverEntrypoint.length === 0) {
		logger
			.withMetadata({ serverEntrypoint })
			.fatal("No SERVER_ENTRYPOINT provided");
		throw new Error("No SERVER_ENTRYPOINT provided");
	}

	const supportedExtensions = ["js", "ts"].flatMap((ext) => [
		`.${ext}`,
		`.${ext}x`,
		`.c${ext}`,
		`.m${ext}`,
	]);
	if (!supportedExtensions.some((ext) => serverEntrypoint.endsWith(ext))) {
		logger
			.withMetadata({ serverEntrypoint, supportedExtensions })
			.warn("Unsupported server entrypoint");
	}

	const templateHtml = isProduction
		? fs.readFileSync(pathToIndex, "utf-8")
		: "";

	if (templateHtml.length !== 0) {
		logger
			.withMetadata({ pathToIndex, templateHtml: templateHtml.length })
			.debug("Loaded server index.html");
	}

	const app = yield* Effect.promise(async () => {
		const ssrExpress = express();
		let vite: Awaited<ReturnType<typeof createViteServer>>;
		if (!isProduction) {
			// Create Vite server in middleware mode and configure the app type as
			// 'custom', disabling Vite's own HTML serving logic so parent server
			// can take control
			vite = await createViteServer({
				server: { middlewareMode: true },
				appType: "custom",
				base: "/",
			});

			// Use vite's connect instance as middleware. If you use your own
			// express router (express.Router()), you should use router.use
			// When the server restarts (for example after the user modifies
			// vite.config.js), `vite.middlewares` is still going to be the same
			// reference (with a new internal stack of Vite and plugin-injected
			// middlewares). The following is valid even after restarts.
			ssrExpress.use(vite.middlewares);
		} else {
			const sirv = (await import("sirv")).default;
			const base = "/";
			logger.info("Serving static files from", env.CLIENT_OUTPUT);
			ssrExpress.use(base, sirv(env.CLIENT_OUTPUT, { extensions: [] }));
		}

		ssrExpress.use(async (request, _, next) => {
			// Create a new LogLayer instance for each request
			request.log = logger
				.withPrefix(`${request.method} ${request.path}`)
				.withContext({
					requestId: ulid(),
				});

			let now = new Date();
			request.log
				.withMetadata({
					now: now.toISOString(),
					url: request.originalUrl,
					method: request.method,
					ip: request.ip,
				})
				.debug();

			next();
		});

		ssrExpress.use("*", async (request, response) => {
			const url = request.originalUrl;
			const logger = request.log;

			try {
				let render: RenderFunction;
				let template = templateHtml;
				if (!isProduction) {
					logger.withMetadata({ pathToIndex }).debug("Reading index.html");
					template = fs.readFileSync(pathToIndex, "utf-8");

					logger
						.withMetadata({
							url,
							template: template.length,
						})
						.debug("Transforming index.html");
					template = await vite.transformIndexHtml(url, template);

					logger
						.withMetadata({
							serverEntrypoint,
							template: template.length,
						})
						.debug("Loading server entry");

					let ssrModule = await vite.ssrLoadModule(serverEntrypoint);
					render = ssrModule.render;
				} else {
					logger
						.withMetadata({
							serverEntrypoint,
							template: template.length,
						})
						.debug("Loading server entry");

					let ssrModule = await import(serverEntrypoint);
					render = ssrModule.render;
				}

				logger.withMetadata({ url, render }).debug("Rendering app HTML");
				const app = await render({ url });

				logger.debug("Injecting app HTML into template");
				const html = template
					.replace(`<!--ssr-head-->`, () => app.ssr.head ?? "")
					.replace(`<!--ssr-html-->`, () => app.ssr.html ?? "");

				logger
					.withMetadata({ url, html: html.length })
					.debug("Sending rendered HTML");
				response.status(200).set({ "Content-Type": "text/html" }).end(html);
			} catch (e) {
				vite?.ssrFixStacktrace(e as Error);
				logger.withError(e).error("Error rendering app HTML");
				response.status(500).end((e as { stack?: string })?.stack);
			}
		});
		logger.info("Server is ready");
		return ssrExpress;
	});

	const port = process.env.PORT ?? 5555;
	logger.withMetadata({ port }).info("Listening on port");
	app.listen(process.env.PORT ?? 5555);
});

const context = Context.empty().pipe(
	withStructuredLogging({ prefix: "server" }),
);
Effect.runFork(Effect.provide(server, context));
