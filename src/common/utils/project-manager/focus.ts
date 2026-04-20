import type { Issue } from "@common/types/project-manager/Issue.ts";
import type { Project } from "@common/types/project-manager/Project.ts";

/**
 * Modo enfoque para neurodivergentes.
 * Devuelve el set de issue ids que deben visualizarse "apagados" (muted)
 * cuando la cantidad de issues en una columna WIP-limitada alcanzó su límite.
 */
export function computeMutedIssueIds(project: Project, issues: Issue[], forced?: boolean): Set<string> {
	const muted = new Set<string>();
	const wipLimits = project.settings?.wipLimits ?? {};

	if (!forced && Object.keys(wipLimits).length === 0) return muted;

	// Contar issues en columnas WIP-limitadas
	const overLimit = new Set<string>();
	for (const [colKey, limit] of Object.entries(wipLimits)) {
		const count = issues.filter((i) => i.columnKey === colKey).length;
		if (count >= limit) overLimit.add(colKey);
	}

	if (!forced && overLimit.size === 0) return muted;

	// Si hay columnas WIP alcanzadas → apagar todos los issues que NO estén en esas columnas
	for (const issue of issues) {
		if (!overLimit.has(issue.columnKey)) muted.add(issue.id);
	}
	return muted;
}
