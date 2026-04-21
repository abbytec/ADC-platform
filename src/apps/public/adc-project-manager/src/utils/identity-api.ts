import { createAdcApi } from "@ui-library/utils/adc-fetch";
import type { Permission, ClientUser, ClientGroup } from "@common/types/identity/index";

/**
 * Cliente dedicado a endpoints de `IdentityManagerService` consumidos por el app PM.
 * Se mantiene aparte de `pm-api.ts` (que expone `/api/pm/...`) para evitar mezclar dominios.
 */
const identityApi = createAdcApi({
	basePath: "/api/identity",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

export type UserPreferences = Record<string, unknown>;

export const identityPmApi = {
	/** Permisos del usuario actual filtrados al recurso `project-manager`. */
	getMyPermissions: () =>
		identityApi.get<{ scopes: Permission[]; orgId?: string; isAdmin?: boolean; isOrgAdmin?: boolean }>("/my-permissions"),

	/** Resuelve `orgId → { orgId, slug }` para construir URLs del PM. */
	getOrganization: (orgId: string) => identityApi.get<{ orgId: string; slug: string }>(`/organizations/${orgId}`),

	/** Verifica si un slug de organización está disponible (para flujos de onboarding/edición). */
	checkOrgSlug: (slug: string) => identityApi.get<{ available: boolean; reserved?: boolean }>(`/organizations/check-slug/${slug}`),

	/** Preferencias persistentes del usuario (guardadas en `user.metadata.preferences`). */
	getMyPreferences: () => identityApi.get<{ preferences: UserPreferences }>("/users/me/preferences"),

	/** Merge superficial (por clave top-level) sobre `user.metadata.preferences`. */
	updateMyPreferences: (patch: UserPreferences) =>
		identityApi.patch<{ preferences: UserPreferences }>("/users/me/preferences", {
			body: patch,
			idempotencyData: patch,
		}),

	/** Búsqueda incremental de usuarios por username/displayName (min 2 chars). */
	searchUsers: (q: string) => identityApi.get<ClientUser[]>("/users/search", { params: { q } }),

	/** Lookup individual por id (para resolver chips de miembros ya seleccionados). */
	getUser: (userId: string) => identityApi.get<ClientUser>(`/users/${userId}`),

	/** Lista grupos visibles al caller. Opcionalmente filtrable por org. */
	listGroups: (orgId?: string) => identityApi.get<ClientGroup[]>("/groups", orgId ? { params: { orgId } } : undefined),
};
