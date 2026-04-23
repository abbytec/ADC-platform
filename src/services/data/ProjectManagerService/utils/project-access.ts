import type { Project } from "@common/types/project-manager/Project.ts";
import type { User } from "@common/types/identity/User.ts";

/**
 * Determina si un usuario tiene acceso a un proyecto según membresía directa,
 * membresía por grupo o role override.
 *
 * No reemplaza el chequeo de permisos del recurso `project-manager`; lo complementa.
 * Un usuario con permiso global PM (`PROJECTS.READ`) ve proyectos incluso sin membresía.
 */
export function isProjectMember(project: Project | null | undefined, user: Pick<User, "id" | "groupIds"> | null): boolean {
	if (!project || !user) return false;
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
		// Membresía explícita (owner, miembro directo o por grupo) siempre concede visibilidad,
		// sin importar si el proyecto es global u org-scoped.
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
