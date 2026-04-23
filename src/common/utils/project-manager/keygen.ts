/**
 * Genera un slug de 3-5 letras mayúsculas a partir del nombre del proyecto.
 * Usado como prefijo en issue keys (`PROJ-123`).
 */
export function deriveProjectKey(name: string): string {
	const cleaned = name
		.toUpperCase()
		.replaceAll(/[^A-Z0-9\s]/g, "")
		.trim();

	const words = cleaned.split(/\s+/).filter(Boolean);

	if (words.length === 0) return "PROJ";
	if (words.length === 1) return words[0].slice(0, 4) || "PROJ";

	// Tomar iniciales de las palabras (máx 5 chars)
	const initials = words
		.map((w) => w[0])
		.join("")
		.slice(0, 5);
	return initials.length >= 2 ? initials : words[0].slice(0, 4);
}

/** Formatea una issue key dado el prefijo y el número. */
export function formatIssueKey(prefix: string, number: number): string {
	return `${prefix}-${number}`;
}
