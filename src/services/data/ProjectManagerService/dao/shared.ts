import type { Model } from "mongoose";
import type { Project } from "@common/types/project-manager/Project.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import { isProjectAccessibleInOrgContext, isProjectMember } from "../utils/project-access.ts";
import type { CallerMembership, ProjectInternals } from "./projects.ts";

/**
 * Devuelve una copia "segura" de `updates` sin las claves que nunca deben
 * mutarse vía un PUT genérico (id, timestamps, contadores, etc.).
 * Centralizado para evitar que cada DAO mantenga su propia blacklist.
 */
export function stripImmutableFields<T extends object>(updates: Partial<T>, keys: readonly (keyof T | string)[]): Partial<T> {
	const safe: Partial<T> = { ...updates };
	for (const key of keys) delete (safe as any)[key];
	return safe;
}

/** Deserializa un doc de mongoose a objeto plano, o devuelve `null`. */
export function docToPlain<T>(doc: any): T | null {
	if (!doc) return null;
	return (doc.toObject?.() ?? doc) as T;
}

/** Fetch by `id` como objeto plano. */
export async function findByIdAsPlain<T>(model: Model<T>, id: string): Promise<T | null> {
	const doc = await model.findOne({ id } as any);
	return docToPlain<T>(doc);
}

/**
 * `allowIf` reutilizable **para operaciones de lectura**: concede acceso al
 * owner del proyecto o a cualquier miembro explícito (directo o por grupo).
 *
 * Requiere que el token del caller esté en el mismo contexto de org que el
 * proyecto (ver `isProjectMember`): un token personal no concede acceso a
 * proyectos org-scoped aunque el usuario sea miembro.
 */
export function projectMemberAllowIf(project: Project | null, caller?: CallerMembership): (uid: string) => boolean {
	const groupIds = caller?.groupIds ?? [];
	const tokenOrgId = caller?.tokenOrgId ?? null;
	return (uid) => isProjectMember(project, { id: uid, groupIds }, tokenOrgId);
}

/**
 * `allowIf` reutilizable **para operaciones de escritura** sobre recursos del
 * proyecto (sprints, milestones, issues): sólo el owner del proyecto pasa por
 * esta vía. El resto necesita permiso formal de su scope (rol PM o equivalente).
 *
 * El owner de un proyecto org-scoped debe además tener el token en esa org;
 * con token personal no puede modificar recursos de su propio proyecto de org.
 */
export function projectOwnerAllowIf(project: Project | null, caller?: CallerMembership): (uid: string) => boolean {
	const tokenOrgId = caller?.tokenOrgId ?? null;
	return (uid) => !!project && project.ownerId === uid && isProjectAccessibleInOrgContext(project, tokenOrgId);
}

/** Carga el proyecto o lanza 404 `PROJECT_NOT_FOUND`. */
export async function requireProject(internals: ProjectInternals, projectId: string): Promise<Project> {
	const project = await internals.fetchProject(projectId);
	if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", `Proyecto ${projectId} no encontrado`);
	return project;
}

/**
 * Carga una entidad que pertenece a un proyecto y resuelve ambos en un solo paso.
 * Usado por sprint/milestone/issue DAOs para el patrón `fetch + requirePermission`.
 */
export async function fetchEntityWithProject<T extends { projectId: string }>(
	model: Model<T>,
	entityId: string,
	internals: ProjectInternals
): Promise<{ entity: T | null; project: Project | null }> {
	const entity = await findByIdAsPlain<T>(model, entityId);
	const project = entity ? await internals.fetchProject(entity.projectId) : null;
	return { entity, project };
}
