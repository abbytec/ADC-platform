import { CRUDXAction } from "../Actions.ts";

export const PM_RESOURCE_NAME = "project-manager" as const;

/**
 * Scopes del recurso `project-manager` (bitfield).
 */
export const PMScopes = {
	NONE: 0,
	PROJECTS: 1, // 1
	ISSUES: 1 << 1, // 2
	SPRINTS: 1 << 2, // 4
	MILESTONES: 1 << 3, // 8
	LABELS: 1 << 4, // 16
	CUSTOM_FIELDS: 1 << 5, // 32
	ATTACHMENTS: 1 << 6, // 64
	SETTINGS: 1 << 7, // 128
	STATS: 1 << 8, // 256
	ALL: 1 | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8), // 511
} as const;

export type PMScopeValue = (typeof PMScopes)[keyof typeof PMScopes];

const SCOPE_NAMES: Record<number, string> = Object.fromEntries(Object.entries(PMScopes).map(([k, v]) => [v, k]));
const ACTION_NAMES: Record<number, string> = Object.fromEntries(Object.entries(CRUDXAction).map(([k, v]) => [v, k]));

export function humanizePMPermission(perm: string): string {
	const parts = perm.split(".");
	if (parts.length !== 3) return perm;
	const [resource, scopeStr, actionStr] = parts;
	const scope = Number(scopeStr);
	const action = Number(actionStr);
	if (Number.isNaN(scope) || Number.isNaN(action)) return perm;
	return `${resource}.${SCOPE_NAMES[scope] ?? scopeStr}.${ACTION_NAMES[action] ?? actionStr}`;
}
