import { CRUDXAction } from "./Actions.ts";
import { RESOURCES, type ResourceDef, type ScopeDef } from "./resources.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Typed permission builder
// ─────────────────────────────────────────────────────────────────────────────

type ScopePermissions<R extends string> = {
	readonly READ: `${R}.${number}.${typeof CRUDXAction.READ}`;
	readonly WRITE: `${R}.${number}.${typeof CRUDXAction.WRITE}`;
	readonly UPDATE: `${R}.${number}.${typeof CRUDXAction.UPDATE}`;
	readonly DELETE: `${R}.${number}.${typeof CRUDXAction.DELETE}`;
	readonly EXECUTE: `${R}.${number}.${typeof CRUDXAction.EXECUTE}`;
	readonly CRUD: `${R}.${number}.${typeof CRUDXAction.CRUD}`;
	readonly ALL: `${R}.${number}.${typeof CRUDXAction.ALL}`;
};

type SimplePermissions<R extends string> = {
	readonly READ: `${R}.read`;
	readonly WRITE: `${R}.write`;
	readonly UPDATE: `${R}.update`;
	readonly DELETE: `${R}.delete`;
	readonly EXECUTE: `${R}.execute`;
};

function buildScopePermissions<R extends string>(resource: R, scope: ScopeDef): ScopePermissions<R> {
	return {
		READ: `${resource}.${scope.value}.${CRUDXAction.READ}`,
		WRITE: `${resource}.${scope.value}.${CRUDXAction.WRITE}`,
		UPDATE: `${resource}.${scope.value}.${CRUDXAction.UPDATE}`,
		DELETE: `${resource}.${scope.value}.${CRUDXAction.DELETE}`,
		EXECUTE: `${resource}.${scope.value}.${CRUDXAction.EXECUTE}`,
		CRUD: `${resource}.${scope.value}.${CRUDXAction.CRUD}`,
		ALL: `${resource}.${scope.value}.${CRUDXAction.ALL}`,
	} as ScopePermissions<R>;
}

function buildSimplePermissions<R extends string>(resource: R): SimplePermissions<R> {
	return {
		READ: `${resource}.read`,
		WRITE: `${resource}.write`,
		UPDATE: `${resource}.update`,
		DELETE: `${resource}.delete`,
		EXECUTE: `${resource}.execute`,
	} as SimplePermissions<R>;
}

function buildResourcePermissions(resource: ResourceDef) {
	if (resource.simple) return buildSimplePermissions(resource.id);

	const result: Record<string, ScopePermissions<string>> = {};
	for (const scope of resource.scopes) {
		result[scope.key.toUpperCase()] = buildScopePermissions(resource.id, scope);
	}
	return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generated permission constants
// ─────────────────────────────────────────────────────────────────────────────

function buildAllPermissions() {
	const result: Record<string, ReturnType<typeof buildResourcePermissions>> = {};
	for (const resource of RESOURCES) {
		result[resource.id.toUpperCase()] = buildResourcePermissions(resource);
	}
	return result;
}

/**
 * Typed permission constants generated from RESOURCES and CRUDXAction.
 *
 * Scoped resources (e.g. identity):
 *   `P.IDENTITY.USERS.READ`  → `"identity.2.1"`
 *   `P.IDENTITY.ROLES.WRITE` → `"identity.4.2"`
 *
 * Simple resources (e.g. content):
 *   `P.CONTENT.WRITE`  → `"content.write"`
 *   `P.CONTENT.DELETE` → `"content.delete"`
 */
export const P = buildAllPermissions() as {
	readonly IDENTITY: {
		readonly SELF: ScopePermissions<"identity">;
		readonly USERS: ScopePermissions<"identity">;
		readonly ROLES: ScopePermissions<"identity">;
		readonly GROUPS: ScopePermissions<"identity">;
		readonly ORGANIZATIONS: ScopePermissions<"identity">;
		readonly REGIONS: ScopePermissions<"identity">;
		readonly STATS: ScopePermissions<"identity">;
	};
	readonly COMMUNITY: {
		readonly CONTENT: ScopePermissions<"community">;
		readonly PUBLISH_STATUS: ScopePermissions<"community">;
		readonly SOCIAL: ScopePermissions<"community">;
	};
};
