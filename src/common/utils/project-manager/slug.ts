/**
 * Normaliza un slug a la forma canónica usada por el PM:
 * minúsculas, trim, y validación de charset `[a-z0-9-]`.
 * Devuelve `null` si el slug es inválido tras normalizar.
 */
export function normalizeSlug(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const slug = raw.trim().toLowerCase();
	if (!slug) return null;
	if (!/^[a-z0-9-]+$/.test(slug)) return null;
	return slug;
}
