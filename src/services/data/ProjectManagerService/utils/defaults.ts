import type { Project, KanbanColumn } from "@common/types/project-manager/Project.ts";
import { shortId } from "@common/utils/crypto.ts";

/** Columnas kanban default según plan (ideas, to-do=auto, in-progress, test, finalizado=done). */
function defaultKanbanColumns(): KanbanColumn[] {
	return [
		{ id: shortId(), key: "ideas", name: "Ideas / Backlog", order: 0 },
		{ id: shortId(), key: "todo", name: "To Do", order: 1, isAuto: true },
		{ id: shortId(), key: "in-progress", name: "In Progress", order: 2 },
		{ id: shortId(), key: "test", name: "Test", order: 3 },
		{ id: shortId(), key: "done", name: "Finalizado", order: 4, isDone: true },
	];
}

/** Estrategia de prioridad default. */
function defaultPriorityStrategy(): Project["priorityStrategy"] {
	return { id: "matrix-eisenhower" };
}

/** Crea un proyecto con defaults en los campos opcionales estructurales. */
export function applyProjectDefaults(partial: Partial<Project> & Pick<Project, "name" | "slug" | "ownerId">): Project {
	const now = new Date();
	return {
		id: partial.id ?? "",
		orgId: partial.orgId ?? null,
		slug: partial.slug,
		name: partial.name,
		description: partial.description,
		ownerId: partial.ownerId,
		visibility: partial.visibility ?? "org",

		memberUserIds: partial.memberUserIds ?? [],
		memberGroupIds: partial.memberGroupIds ?? [],
		roleOverrides: partial.roleOverrides ?? [],

		kanbanColumns: partial.kanbanColumns?.length ? partial.kanbanColumns : defaultKanbanColumns(),
		customFieldDefs: partial.customFieldDefs ?? [],
		issueLinkTypes: partial.issueLinkTypes ?? [],
		priorityStrategy: partial.priorityStrategy ?? defaultPriorityStrategy(),
		settings: partial.settings ?? {},

		issueCounter: partial.issueCounter ?? 0,

		createdAt: partial.createdAt ?? now,
		updatedAt: partial.updatedAt ?? now,
	};
}

/** Asegura que exista al menos una columna `isAuto` y una `isDone`. */
export function validateKanbanColumns(columns: KanbanColumn[]): void {
	if (!columns.length) throw new Error("Debe haber al menos una columna");
	const hasAuto = columns.some((c) => c.isAuto);
	const hasDone = columns.some((c) => c.isDone);
	if (!hasAuto) throw new Error("Debe haber al menos una columna `isAuto` (donde caen nuevos issues)");
	if (!hasDone) throw new Error("Debe haber al menos una columna `isDone` (finalizado)");
}
