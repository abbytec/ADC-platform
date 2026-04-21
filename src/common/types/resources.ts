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

/** Community-specific scopes (Discord autoroles) - alineados con CommunityScopes en systemRoles.ts */
export const COMMUNITY_SCOPES_MAP = {
	CONTENT: 1,
	PUBLISH_STATUS: 1 << 1,
	SOCIAL: 1 << 2,
} as const;

const COMMUNITY_SCOPES: ScopeDef[] = [
	{ key: "content", value: COMMUNITY_SCOPES_MAP.CONTENT },
	{ key: "publish_status", value: COMMUNITY_SCOPES_MAP.PUBLISH_STATUS },
	{ key: "social", value: COMMUNITY_SCOPES_MAP.SOCIAL },
];

/** Project Manager scopes — alineados con PMScopes en types/project-manager/permissions.ts */
const PROJECT_MANAGER_SCOPES: ScopeDef[] = [
	{ key: "projects", value: 1 },
	{ key: "issues", value: 1 << 1 },
	{ key: "sprints", value: 1 << 2 },
	{ key: "milestones", value: 1 << 3 },
	{ key: "custom_fields", value: 1 << 5 },
	{ key: "attachments", value: 1 << 6 },
	{ key: "settings", value: 1 << 7 },
	{ key: "stats", value: 1 << 8 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Resource registry — only resources that have real endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCES: ResourceDef[] = [
	{ id: "identity", label: "resources.identity", scopes: IDENTITY_SCOPES },
	{ id: "content", label: "resources.content", scopes: [], simple: true },
	{ id: "community", label: "resources.community", scopes: COMMUNITY_SCOPES },
	{ id: "project-manager", label: "resources.project-manager", scopes: PROJECT_MANAGER_SCOPES },
];

/**
 * Lookup by resource id
 * @public
 */
export const RESOURCE_MAP: ReadonlyMap<string, ResourceDef> = new Map(RESOURCES.map((r) => [r.id, r]));

/**
 * Get scopes for a resource (falls back to empty)
 * @public
 */
export function getResourceScopes(resourceId: string): ScopeDef[] {
	return RESOURCE_MAP.get(resourceId)?.scopes ?? [];
}
