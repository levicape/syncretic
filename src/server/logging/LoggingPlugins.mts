import { randomBytes } from "node:crypto";
import type { LogLayerPlugin } from "loglayer";
import { DurationPlugin } from "./plugins/DurationPlugin.mjs";
import { OtelLogPlugin } from "./plugins/OtelLogPlugin.mjs";
import { UnixtimeLogPlugin } from "./plugins/UnixtimeLogPlugin.mjs";

export const $$_traceId_$$ = () => randomBytes(16).toString("hex");
export const $$_spanId_$$ = () => randomBytes(8).toString("hex");

/**
 * Default logging plugins
 * - UnixtimeLogPlugin: Adds a unixtime field to the log
 * - OtelLogPlugin: Adds OpenTelemetry-like spanId and traceId fields to the log
 * - DurationPlugin: Adds a duration field to the log
 * @see https://loglayer.dev/docs/plugins
 *
 * @see UnixtimeLogPlugin
 * @see OtelLogPlugin
 * @see DurationPlugin
 */
export const LoggingPlugins: Array<LogLayerPlugin> = [
	UnixtimeLogPlugin,
	OtelLogPlugin(),
	DurationPlugin,
];
