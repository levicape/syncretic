import { randomBytes } from "node:crypto";
import type { LogLayerPlugin } from "loglayer";

export const $$_traceId_$$ = () => randomBytes(16).toString("hex");
export const $$_spanId_$$ = () => randomBytes(8).toString("hex");

type Depth = number;
export const LoggingPlugins: Array<LogLayerPlugin> = [
	{
		id: "unixtime-plugin",
		onBeforeDataOut: ({ data }) => {
			if (data) {
				data.unixtime = Date.now();
			}
			return data;
		},
	},
	((): LogLayerPlugin => {
		const latestLeaf = new Map<string, [string, Depth]>();

		const load = (parentSpanId: string) => {
			const spanId = latestLeaf.get(parentSpanId);
			if (spanId !== undefined) {
				return spanId;
			}
			return [parentSpanId, 1] as [string, Depth];
		};

		const store = (parentSpanId: string, spanId: string, depth: number) => {
			latestLeaf.set(parentSpanId, [spanId, depth]);
		};

		/**
		 * Purge any span graphs deeper than depth
		 */
		const purge = (depth: Depth) => {
			for (const [parentSpanId, [_, d]] of latestLeaf) {
				if (d > depth) {
					latestLeaf.delete(parentSpanId);
				}
			}
		};

		return {
			id: "otel-plugin",
			onContextCalled(context, loglayer) {
				// Lift rootId and loggerId to the context as traceId and spanId
				const { spanId: existingSpanId, parentSpanId: existingParentSpanId } =
					loglayer.getContext() as {
						spanId?: string;
						parentSpanId?: string;
					};

				// Values added by withContext
				const { _$span, $event } = context as {
					_$span?: "root" | "logger";
					$event?: string;
				};

				if (["root", "logger"].includes(_$span ?? "")) {
					// biome-ignore lint:
					delete context._$span;
					return context;
				}

				if ($event !== undefined && existingSpanId !== undefined) {
					context.parentSpanId = existingSpanId ?? existingParentSpanId;
					context.spanId = $$_spanId_$$();
					context._depth = (latestLeaf.get(context.parentSpanId)?.[1] ?? 0) + 1;
					store(context.parentSpanId, context.spanId, context._depth);
				}

				return context;
			},
			onMetadataCalled(metadata, loglayer) {
				const { spanId } = loglayer.getContext();
				metadata.spanId = $$_spanId_$$();
				metadata.parentSpanId = spanId;

				const previous = load(metadata.parentSpanId);
				if (previous[0] !== metadata.parentSpanId) {
					metadata.__previousSpanId = previous[0];
				}

				store(metadata.parentSpanId, metadata.spanId, previous[1] + 1);
				return metadata;
			},
			onBeforeDataOut: (() => {
				return ({ data }) => {
					if (data) {
						const { spanId, rootId, parentSpanId, traceId, loggerId, _$span } =
							data as {
								_$span?: "logger";
								_depth?: number;
								rootId?: string;
								loggerId: string;
								traceId?: string;
								spanId?: string;
								parentSpanId?: string;
							};

						// biome-ignore lint:
						delete data._depth;

						// Use rootId if traceId is not already set
						const tid = traceId || rootId;

						// Spans are created on withMetadata calls
						let sid = spanId ?? $$_spanId_$$();

						// Parent span id
						let psid = parentSpanId;

						if (tid !== undefined) {
							data.traceId = tid;
						}
						data.spanId = sid;
						if (psid !== undefined) {
							data.parentSpanId = psid;
						}
					}

					if (latestLeaf.size > 2 ** 16) {
						purge(1);
					}

					return data;
				};
			})(),
		};
	})(),
	{
		id: "duration-plugin",
		onBeforeDataOut: (() => {
			const rootTimestamp = Date.now();
			const spanTimestamps = new Map<string, number>();

			const store = (spanId: string, timestamp: number) => {
				spanTimestamps.set(spanId, timestamp);
			};

			const duration = (parentSpanId?: string) => {
				const start = parentSpanId
					? spanTimestamps.get(parentSpanId)
					: rootTimestamp;
				const end = Date.now();
				return end - (start ?? rootTimestamp);
			};

			/**
			 * Purge any spans older than ageInSeconds
			 * @param ageInSeconds
			 */
			const purge = (ageInSeconds: number) => {
				const now = Date.now();
				for (const [spanId, timestamp] of spanTimestamps) {
					if (now - timestamp > ageInSeconds * 1000) {
						spanTimestamps.delete(spanId);
					}
				}
			};

			return ({ data }) => {
				if (data) {
					const { spanId, __previousSpanId, parentSpanId } = data as {
						parentSpanId?: string;
						spanId?: string;
						__previousSpanId?: string;
					};
					if (spanId) {
						if (spanTimestamps.size > 2 ** 16) {
							purge(60);
						}
						store(spanId, data.timestamp ?? Date.now());
					}

					if (data.duration === undefined) {
						data.duration = duration(__previousSpanId ?? parentSpanId);
					}

					if (__previousSpanId) {
						store(__previousSpanId, data.timestamp ?? Date.now());
					}
					if (parentSpanId) {
						store(parentSpanId, data.timestamp ?? Date.now());
					}

					// biome-ignore lint:
					delete data.__previousSpanId;
				}
				return data;
			};
		})(),
	},
];
