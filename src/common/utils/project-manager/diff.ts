import type { UpdateLogEntry } from "@common/types/project-manager/UpdateLogEntry.ts";
import type { Issue } from "@common/types/project-manager/Issue.ts";

/** Campos del issue que NO deben trackearse en el update log. */
const IGNORED_FIELDS = new Set<keyof Issue>(["updateLog", "updatedAt", "createdAt", "id", "key", "projectId"]);

/**
 * Calcula diffs campo a campo entre el issue actual y los updates propuestos.
 * Para `description`, siempre se guarda snapshot completo (old/new) aunque el string sea largo.
 */
export function buildDiffEntries(current: Issue, updates: Partial<Issue>, byUserId: string, reason?: string): UpdateLogEntry[] {
	const entries: UpdateLogEntry[] = [];
	const now = new Date();

	for (const rawKey of Object.keys(updates)) {
		const key = rawKey as keyof Issue;
		if (IGNORED_FIELDS.has(key)) continue;

		const oldValue = (current as unknown as Record<string, unknown>)[key];
		const newValue = (updates as unknown as Record<string, unknown>)[key];

		if (isEqual(oldValue, newValue)) continue;

		entries.push({ at: now, byUserId, field: String(key), oldValue, newValue, reason });
	}

	return entries;
}

function isEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return a == null && b == null;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!isEqual(a[i], b[i])) return false;
		return true;
	}
	if (typeof a === "object" && typeof b === "object") {
		try {
			return JSON.stringify(a) === JSON.stringify(b);
		} catch {
			return false;
		}
	}
	return false;
}
