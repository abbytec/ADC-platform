import type { Project } from "@common/types/project-manager/Project.ts";
import type { User } from "@common/types/identity/User.ts";

/**
 * Un proyecto org-scoped (`orgId != null`) sólo es accesible si el token actual
 * del caller apunta a esa misma organización. Un token personal (`tokenOrgId=null`)
 * no debe ver/operar proyectos de org aunque el usuario sea miembro.
 *
 * Para proyectos globales (`orgId=null`) no aplica restricción de org.
 */
export function isProjectAccessibleInOrgContext(project: Project | null | undefined, tokenOrgId: string | null | undefined): boolean {
	if (!project) return false;
	if (!project.orgId) return true;
	return (tokenOrgId ?? null) === project.orgId;
}

/**
 * Determina si un usuario tiene acceso a un proyecto según membresía directa,
 * membresía por grupo o role override.
 *
 * No reemplaza el chequeo de permisos del recurso `project-manager`; lo complementa.
 * Un usuario con permiso global PM (`PROJECTS.READ`) ve proyectos incluso sin membresía.
 *
 * Si el proyecto es org-scoped, `tokenOrgId` debe coincidir con `project.orgId`;
 * de lo contrario se deniega sin importar la membresía (aislamiento de contexto).
 */
export function isProjectMember(
	project: Project | null | undefined,
	user: Pick<User, "id" | "groupIds"> | null,
	tokenOrgId: string | null = null
): boolean {
	if (!project || !user) return false;
	if (!isProjectAccessibleInOrgContext(project, tokenOrgId)) return false;
	if (project.ownerId === user.id) return true;
	if (project.memberUserIds?.includes(user.id)) return true;
	const groupIds = user.groupIds ?? [];
	return project.memberGroupIds?.some((gid) => groupIds.includes(gid)) ?? false;
}

/**
 * Filtra proyectos según reglas de visibilidad org-scoped / global (ver plan §3.6).
 *
 * @param projects lista completa (ya cargada por query base de orgId)
 * @param ctx contexto del caller: orgId del token, permisos globales PM, userId y groupIds
 */
export function filterVisibleProjects(
	projects: Project[],
	ctx: {
		userId: string;
		groupIds: string[];
		tokenOrgId: string | null;
		hasGlobalPMRead: boolean;
		isGlobalAdmin: boolean;
	}
): Project[] {
	if (ctx.isGlobalAdmin) return projects;

	return projects.filter((p) => {
		// Aislamiento por contexto: proyectos org-scoped sólo son visibles si el
		// token actual apunta a esa org. Un token personal NO debe ver proyectos
		// de org aunque el usuario sea owner/miembro (debe switchear primero).
		if (!isProjectAccessibleInOrgContext(p, ctx.tokenOrgId)) return false;

		// Membresía explícita (owner, miembro directo o por grupo) concede visibilidad
		// una vez validado el contexto de org.
		const isExplicitMember =
			p.ownerId === ctx.userId ||
			(p.memberUserIds?.includes(ctx.userId) ?? false) ||
			(p.memberGroupIds?.some((gid) => ctx.groupIds.includes(gid)) ?? false);
		if (isExplicitMember) return true;

		// Proyectos privados: sólo owner/miembros o admin global (ya filtrado arriba).
		if (p.visibility === "private") return false;

		// Proyectos globales (orgId=null) no privados: visibles para roles con PM read.
		if (p.orgId === null) return ctx.hasGlobalPMRead;

		// Proyectos de org: el caller debe pertenecer a la org.
		return !!(ctx.tokenOrgId && p.orgId === ctx.tokenOrgId);
	});
}
