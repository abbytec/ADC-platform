// ─────────────────────────────────────────────────────────────────────────────
// Action (bitfield) — Source of truth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acciones disponibles como bitfield.
 * Permite combinaciones: READ | WRITE = 3
 */
export const Action = {
	NONE: 0,
	READ: 1, // 1
	WRITE: 2, // 2
	RW: 3, // 3
	UPDATE: 4, // 4
	DELETE: 8, // 8
	EXECUTE: 16, // 16
	CRUD: 15, // 15
	ALL: 31, // 31
} as const;

export type Action = (typeof Action)[keyof typeof Action];

// ─────────────────────────────────────────────────────────────────────────────
// Resource
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCE_NAME = "identity" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Scope (bitfield)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Áreas de alcance en el sistema de identidad (bitfield).
 * Permite combinaciones: USERS | GROUPS = 10
 */
export const IdentityScope = {
	NONE: 0,
	SELF: 1, // 1
	USERS: 1 << 1, // 2
	ROLES: 1 << 2, // 4
	GROUPS: 1 << 3, // 8
	ORGANIZATIONS: 1 << 4, // 16
	REGIONS: 1 << 5, // 32
	STATS: 1 << 6, // 64
	ALL: 1 | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6), // 127
} as const;

export type IdentityScope = (typeof IdentityScope)[keyof typeof IdentityScope];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un bitfield contiene todos los flags requeridos
 */
export function hasFlags(value: number, required: number): boolean {
	return (value & required) === required;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse maps (numeric value → name)
// ─────────────────────────────────────────────────────────────────────────────

/** Mapa inverso de valor numérico de scope a nombre legible */
const SCOPE_NAMES: Record<number, string> = Object.fromEntries(Object.entries(IdentityScope).map(([k, v]) => [v, k]));

/** Mapa inverso de valor numérico de action a nombre legible */
const ACTION_NAMES: Record<number, string> = Object.fromEntries(Object.entries(Action).map(([k, v]) => [v, k]));

/**
 * Traduce un permission string numérico a formato legible.
 * @example humanizePermission("identity.4.1") → "identity.ROLES.READ (scope: 4, action: 1)"
 */
export function humanizePermission(perm: string): string {
	const parts = perm.split(".");
	if (parts.length !== 3) return perm;
	const [resource, scopeStr, actionStr] = parts;
	const scope = Number(scopeStr);
	const action = Number(actionStr);
	if (Number.isNaN(scope) || Number.isNaN(action)) return perm;
	const scopeName = SCOPE_NAMES[scope] ?? scopeStr;
	const actionName = ACTION_NAMES[action] ?? actionStr;
	return `${resource}.${scopeName}.${actionName} (scope: ${scope}, action: ${action})`;
}
