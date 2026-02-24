import type { Permission } from "../../utils/identity-api.ts";
import { ACTIONS } from "./constants.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Bitfield helpers (identity-style: resource.scope.action)
// ─────────────────────────────────────────────────────────────────────────────

export function buildBitfieldMap(permissions: Permission[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const perm of permissions) {
		const key = `${perm.resource}:${perm.scope}`;
		map.set(key, (map.get(key) ?? 0) | perm.action);
	}
	return map;
}

export function bitfieldMapToPermissions(permMap: Map<string, number>): Permission[] {
	const result: Permission[] = [];
	for (const [key, action] of permMap) {
		if (action > 0) {
			const [resource, scopeStr] = key.split(":");
			result.push({ resource, action, scope: Number(scopeStr) });
		}
	}
	return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple helpers (content-style: resource.action as string)
// ─────────────────────────────────────────────────────────────────────────────

export function getSimpleActions(permissions: Permission[], resource: string): Set<string> {
	const set = new Set<string>();
	for (const p of permissions) {
		if (p.resource === resource) {
			for (const a of ACTIONS) {
				if ((p.action & a.value) === a.value) set.add(a.key);
			}
		}
	}
	return set;
}
