export function escapeCodeBlock(string: string): string {
	return string.replace(/`/g, "\\`");
}

export function escapePowershell(string: string): string {
	return string.replace(/'/g, "''").replace(/`/g, "``");
}
