import { Config } from "effect";
/**
 * Configuration for Spork logging.
 */
export class LoggingConfig {
	/**
	 * Number representing the log level. 0 is the least verbose, 5 is the most verbose.
	 */
	constructor(
		readonly LOG_LEVEL: number,
		readonly CI: string,
	) {}
}

/**
 * Effectjs configuration for Spork Logging.
 */
export const LoggingConfigMain = Config.map(
	Config.all([
		Config.number("LOG_LEVEL").pipe(Config.withDefault(3)),
		Config.string("CI").pipe(Config.withDefault("")),
	] as const),
	([level, ci]) => new LoggingConfig(level, ci),
);
