/**
 * Parche de texto por líneas en una sola tijera (`LineSplice`).
 *
 * Lo comparten el navegador y el Drive para el autoguardado: el cliente manda
 * el tramo que cambió en vez del archivo entero. Una sola tijera —recortando
 * prefijo y sufijo comunes— alcanza para el tecleo real sin traer un diff con
 * LCS; dos ediciones lejanas caen en un tramo grande y ahí `spliceIsWorthIt`
 * dice que conviene subir el archivo completo.
 */

export interface LineSplice {
	/** Índice de la primera línea reemplazada. */
	at: number;
	/** Cuántas líneas del original se quitan. */
	remove: number;
	/** Líneas que ocupan su lugar. */
	insert: string[];
}

/** Tijera que convierte `base` en `next`. Textos idénticos dan `remove: 0` e `insert: []`. */
export function diffLineSplice(base: string, next: string): LineSplice {
	const a = base.split("\n");
	const b = next.split("\n");
	let start = 0;
	const common = Math.min(a.length, b.length);
	while (start < common && a[start] === b[start]) start++;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}
	return { at: start, remove: endA - start, insert: b.slice(start, endB) };
}

/** Aplica la tijera. `null` si no encaja en el texto base (parche de otra versión o corrupto). */
export function applyLineSplice(base: string, op: LineSplice): string | null {
	if (!Number.isInteger(op.at) || !Number.isInteger(op.remove) || op.at < 0 || op.remove < 0) return null;
	if (!Array.isArray(op.insert) || op.insert.some((line) => typeof line !== "string")) return null;
	const lines = base.split("\n");
	if (op.at + op.remove > lines.length) return null;
	lines.splice(op.at, op.remove, ...op.insert);
	return lines.join("\n");
}

/**
 * Tope del cuerpo de un parche. No es una proporción del archivo: el parche
 * nunca es más grande que el contenido nuevo y siempre ahorra viajes (uno solo
 * contra presign + PUT a S3 + confirm). Lo que se acota es cuánto texto pasa
 * *por el servidor*, que con la subida directa a S3 no lo toca.
 */
export const MAX_SPLICE_LENGTH = 256 * 1024;

/** `true` si conviene mandar la tijera en vez de subir el archivo entero a S3. */
export function spliceIsWorthIt(op: LineSplice): boolean {
	return op.insert.reduce((total, line) => total + line.length + 1, 0) <= MAX_SPLICE_LENGTH;
}
