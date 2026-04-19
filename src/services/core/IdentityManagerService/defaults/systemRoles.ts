import { CRUDXAction } from "@common/types/Actions.ts";
import { Permission } from "@common/types/identity/Permission.ts";
import { RESOURCE_NAME, IdentityScopes } from "@common/types/identity/permissions.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Community scopes (bitfield) — Alcances para recursos community
// ─────────────────────────────────────────────────────────────────────────────

export const CommunityScopes = {
	CONTENT: 1,
	PUBLISH_STATUS: 1 << 1, // 2
	COMMENTS: 1 << 2, // 4
} as const;

export enum SystemRole {
	SYSTEM = "SYSTEM",
	ADMIN = "Admin",
	NETWORK_MANAGER = "Network Manager",
	SECURITY_MANAGER = "Security Manager",
	DATA_MANAGER = "Data Manager",
	APP_MANAGER = "App Manager",
	CONFIG_MANAGER = "Config Manager",
	USER = "User",
	// Community roles (Discord autoroles)
	DISCORD_VIP = "Discord VIP",
	DISCORD_NITRO_BOOSTER = "Discord Nitro Booster",
	DISCORD_PUBLISHER = "Discord Publisher",
	DISCORD_REVIEWER = "Discord Reviewer",
}

export const PREDEFINED_ROLES: Array<{ name: SystemRole; description: string; permissions: Permission[] }> = [
	{
		name: SystemRole.SYSTEM,
		description: "Usuario del sistema con acceso total",
		permissions: [{ resource: RESOURCE_NAME, action: CRUDXAction.CRUD, scope: IdentityScopes.ALL }],
	},
	{
		name: SystemRole.ADMIN,
		description: "Administrador del sistema",
		permissions: [{ resource: RESOURCE_NAME, action: CRUDXAction.CRUD, scope: IdentityScopes.ALL }],
	},
	{
		name: SystemRole.NETWORK_MANAGER,
		description: "Gestor de redes",
		permissions: [
			{ resource: "network", action: CRUDXAction.CRUD, scope: 0xff },
			{ resource: "devices", action: CRUDXAction.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.SECURITY_MANAGER,
		description: "Gestor de seguridad",
		permissions: [
			{ resource: "security", action: CRUDXAction.CRUD, scope: 0xff },
			{ resource: "users", action: CRUDXAction.READ, scope: 0xff },
			{ resource: "audit", action: CRUDXAction.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.DATA_MANAGER,
		description: "Gestor de datos",
		permissions: [
			{ resource: "data", action: CRUDXAction.CRUD, scope: 0xff },
			{ resource: "database", action: CRUDXAction.CRUD, scope: 0xff },
		],
	},
	{
		name: SystemRole.APP_MANAGER,
		description: "Gestor de aplicaciones",
		permissions: [
			{ resource: "apps", action: CRUDXAction.CRUD, scope: 0xff },
			{ resource: "modules", action: CRUDXAction.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.CONFIG_MANAGER,
		description: "Gestor de configuración",
		permissions: [
			{ resource: "config", action: CRUDXAction.CRUD, scope: 0xff },
			{ resource: "system", action: CRUDXAction.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.USER,
		description: "Usuario estándar del sistema",
		permissions: [{ resource: RESOURCE_NAME, action: CRUDXAction.READ, scope: IdentityScopes.SELF }],
	},
	// ─── Community roles (Discord autoroles) ─────────────────────────────────
	{
		name: SystemRole.DISCORD_VIP,
		description: "Miembro VIP de la comunidad Discord",
		permissions: [{ resource: "community", action: CRUDXAction.RW, scope: CommunityScopes.COMMENTS }],
	},
	{
		name: SystemRole.DISCORD_NITRO_BOOSTER,
		description: "Nitro Booster del servidor de Discord",
		permissions: [{ resource: "community", action: CRUDXAction.RW, scope: CommunityScopes.COMMENTS }],
	},
	{
		name: SystemRole.DISCORD_PUBLISHER,
		description: "Publicador de contenido de la comunidad",
		permissions: [
			{ resource: "community", action: CRUDXAction.READ | CRUDXAction.WRITE | CRUDXAction.UPDATE, scope: CommunityScopes.CONTENT },
		],
	},
	{
		name: SystemRole.DISCORD_REVIEWER,
		description: "Revisor de contenido de la comunidad",
		permissions: [
			{ resource: "community", action: CRUDXAction.CRUD, scope: CommunityScopes.CONTENT },
			{ resource: "community", action: CRUDXAction.CRUD, scope: CommunityScopes.PUBLISH_STATUS },
		],
	},
];

/**
 * Roles predefinidos para organizaciones.
 * Mismos nombres que los globales pero con alcance limitado a la organización.
 * Excluye SYSTEM (siempre global) — los roles globales cascadean a orgs.
 */
export const ORG_PREDEFINED_ROLES: Array<{ name: SystemRole; description: string; permissions: Permission[] }> = PREDEFINED_ROLES.filter(
	(r) => r.name !== SystemRole.SYSTEM
);
