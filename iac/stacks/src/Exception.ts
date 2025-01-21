import { error } from "node:console";

export class JsonParseException extends Error {
	name: string;

	constructor(
		readonly cause: unknown,
		readonly json: string,
	) {
		super((cause as { message: string })?.message ?? "Unknown error");
		this.name = "JsonParseException";
		error(`Failed to parse JSON: ${JSON.stringify(json)}`);
	}
}
