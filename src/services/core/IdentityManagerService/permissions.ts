/**
 * Nombre del recurso para IdentityManagerService
 */
export const RESOURCE_NAME = "identity" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Scope (bitfield)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Áreas de alcance como bitfield
 * Permite combinaciones: USERS | GROUPS = 10
 */
export const Scope = {
	NONE: 0,
	SELF: 1 << 0, // 1
	USERS: 1 << 1, // 2
	ROLES: 1 << 2, // 4
	GROUPS: 1 << 3, // 8
	ORGANIZATIONS: 1 << 4, // 16
	REGIONS: 1 << 5, // 32
	STATS: 1 << 6, // 64
	ALL: (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6), // 127
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un bitfield contiene todos los flags requeridos
 */
export function hasFlags(value: number, required: number): boolean {
	return (value & required) === required;
}

/**
 * Verifica si un bitfield contiene al menos uno de los flags
 */
export function hasAnyFlag(value: number, flags: number): boolean {
	return (value & flags) !== 0;
}
