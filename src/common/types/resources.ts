// ─────────────────────────────────────────────────────────────────────────────
// Scope definition
// ─────────────────────────────────────────────────────────────────────────────

export interface ScopeDef {
	/** Unique key (used for i18n: `permissions.{key}`) */
	key: string;
	/** Bitfield value */
	value: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource definition
// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceDef {
	/** Resource identifier (matches Permission.resource) */
	id: string;
	/** i18n label key: `resources.{id}` */
	label: string;
	/**
	 * Named scopes (bitfield).
	 * Resources with `simple: true` ignore scopes and use direct action names.
	 */
	scopes: ScopeDef[];
	/**
	 * Simple permission model: `resource.action` (string match) instead of
	 * bitfield `resource.scope.action`. When true, scopes are irrelevant —
	 * only the action names matter.
	 */
	simple?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope presets
// ─────────────────────────────────────────────────────────────────────────────

/** Identity-specific scopes (matches IdentityScope from identity.ts) */
const IDENTITY_SCOPES: ScopeDef[] = [
	{ key: "self", value: 1 },
	{ key: "users", value: 1 << 1 },
	{ key: "roles", value: 1 << 2 },
	{ key: "groups", value: 1 << 3 },
	{ key: "organizations", value: 1 << 4 },
	{ key: "regions", value: 1 << 5 },
	{ key: "stats", value: 1 << 6 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Resource registry — only resources that have real endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCES: ResourceDef[] = [
	{ id: "identity", label: "resources.identity", scopes: IDENTITY_SCOPES },
	{ id: "content", label: "resources.content", scopes: [], simple: true },
];

/** Lookup by resource id */
export const RESOURCE_MAP: ReadonlyMap<string, ResourceDef> = new Map(RESOURCES.map((r) => [r.id, r]));

/** Get scopes for a resource (falls back to empty) */
export function getResourceScopes(resourceId: string): ScopeDef[] {
	return RESOURCE_MAP.get(resourceId)?.scopes ?? [];
}
