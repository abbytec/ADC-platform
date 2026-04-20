import { useCallback, useEffect, useState } from "react";
import type { Issue } from "@common/types/project-manager/Issue.ts";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import { pmApi, type IssueListParams } from "../utils/pm-api.ts";

interface Params {
	projectId: string;
	q: string;
	orderBy: IssueListParams["orderBy"];
}

/**
 * Carga issues + sprints + milestones de un proyecto en paralelo.
 * Expone también `setIssues` para updates optimistas y `reload` para forzar refresh.
 */
export function useBacklogData({ projectId, q, orderBy }: Params) {
	const [issues, setIssues] = useState<Issue[]>([]);
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [milestones, setMilestones] = useState<Milestone[]>([]);
	const [loading, setLoading] = useState(true);

	const reload = useCallback(async () => {
		setLoading(true);
		const params: IssueListParams = { orderBy };
		if (q) params.q = q;
		const [issuesRes, sprintsRes, milestonesRes] = await Promise.all([
			pmApi.listIssues(projectId, params),
			pmApi.listSprints(projectId),
			pmApi.listMilestones(projectId),
		]);
		if (issuesRes.success && issuesRes.data) setIssues(issuesRes.data.issues);
		if (sprintsRes.success && sprintsRes.data) setSprints(sprintsRes.data.sprints);
		if (milestonesRes.success && milestonesRes.data) setMilestones(milestonesRes.data.milestones);
		setLoading(false);
	}, [projectId, q, orderBy]);

	useEffect(() => {
		reload();
	}, [reload]);

	return { issues, setIssues, sprints, milestones, loading, reload };
}
