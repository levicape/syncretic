import { Config } from "effect";
/**
 * Configuration for Levicape-specific logging.
 */
export class LoggingConfigLevicape {
	constructor(
		/**
		 * Tagged resource name.
		 * @defaultValue undefined
		 */
		readonly PULUMI__NAME: string | undefined,
	) {}
}

/**
 * Effectjs AWS logging configuration.
 */
export const LoggingConfigLevicapeMain = Config.map(
	Config.all([
		Config.string("PULUMI__NAME").pipe(
			Config.withDefault(""),
			Config.withDescription("Tagged resource name."),
		),
	] as const),
	([pulumiName]) =>
		new LoggingConfigLevicape(pulumiName.length > 0 ? pulumiName : undefined),
);
