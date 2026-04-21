/**
 * Genera un identificador corto único en el navegador.
 * No usamos `@common/utils/crypto.ts` porque depende de `node:crypto`, que los
 * bundlers del frontend no resuelven.
 */
export function shortId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
	}
	return Math.random().toString(36).slice(2, 14);
}
