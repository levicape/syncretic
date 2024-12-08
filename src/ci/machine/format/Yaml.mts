export function toYaml(obj: object, indent = 0) {
	const spaces = " ".repeat(indent);
	let result = "";
	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined) {
			continue;
		}
		if (value === null) {
			result += `${spaces}${key}: null\n`;
			continue;
		}
		if (Array.isArray(value)) {
			result += `${spaces}${key}:\n`;
			value.forEach((item) => {
				if (typeof item === "object" && item !== null) {
					result += `${spaces}- \n${toYaml(item, indent + 2)
						.split("\n")
						.map((line) => `${spaces}  ${line}`)
						.join("\n")}\n`;
				} else {
					result += `${spaces}- ${item}\n`;
				}
			});
			continue;
		}
		if (typeof value === "object") {
			result += `${spaces}${key}:\n${toYaml(value, indent + 2)}`;
			continue;
		}
		if (
			typeof value === "string" &&
			(value.includes(":") ||
				value.includes("#") ||
				value.includes("'") ||
				value.includes('"') ||
				value.includes("\n"))
		) {
			result += `${spaces}${key}: "${value.replace(/"/g, '\\"')}"\n`;
			continue;
		}
		result += `${spaces}${key}: ${value}\n`;
	}
	return result;
}
