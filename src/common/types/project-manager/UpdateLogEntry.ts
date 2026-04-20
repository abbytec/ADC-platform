/**
 * Entrada append-only del historial de un issue.
 * Para cambios en `description` se guarda snapshot completo en `newValue`/`oldValue`
 * y `field === "description"` (para reconstruir versiones antiguas en UI).
 */
export interface UpdateLogEntry {
	at: Date;
	byUserId: string;
	field: string;
	oldValue: unknown;
	newValue: unknown;
	reason?: string;
}
