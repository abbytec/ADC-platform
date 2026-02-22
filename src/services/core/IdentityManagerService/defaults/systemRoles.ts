import { CRUDXAction } from "@common/types/Actions.ts";
import { Permission } from "../domain/permission.ts";
import { RESOURCE_NAME, IdentityScope } from "@common/types/identity.js";

export enum SystemRole {
	SYSTEM = "SYSTEM",
	ADMIN = "Admin",
	NETWORK_MANAGER = "Network Manager",
	SECURITY_MANAGER = "Security Manager",
	DATA_MANAGER = "Data Manager",
	APP_MANAGER = "App Manager",
	CONFIG_MANAGER = "Config Manager",
	USER = "User",
}

export const PREDEFINED_ROLES: Array<{ name: SystemRole; description: string; permissions: Permission[] }> = [
	{
		name: SystemRole.SYSTEM,
		description: "Usuario del sistema con acceso total",
		permissions: [{ resource: RESOURCE_NAME, action: CRUDXAction.CRUD, scope: IdentityScope.ALL }],
	},
	{
		name: SystemRole.ADMIN,
		description: "Administrador del sistema",
		permissions: [{ resource: RESOURCE_NAME, action: CRUDXAction.CRUD, scope: IdentityScope.ALL }],
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
		permissions: [{ resource: RESOURCE_NAME, action: CRUDXAction.READ, scope: IdentityScope.SELF }],
	},
];
