import type { LogLayerPlugin } from "loglayer";
import { $$_spanId_$$ } from "../LoggingPlugins.mjs";

type Depth = number;
/**
 * Contextualizes logs with OpenTelemetry-like spanId and traceId
 * @see https://opentelemetry.io/docs/concepts/signals/traces/
 * @returns LogLayerPlugin
 */
export const OtelLogPlugin: () => LogLayerPlugin = () => {
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
					const { spanId, rootId, parentSpanId, traceId } = data as {
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
};
