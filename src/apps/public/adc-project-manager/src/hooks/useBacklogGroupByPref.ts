import { useEffect, useState } from "react";
import { identityPmApi } from "../utils/identity-api.ts";
import type { GroupBy } from "../components/backlog/BacklogFilters.tsx";

const PM_PREFS_KEY = "projectManager";

interface PmPreferences {
	backlogGroupBy?: GroupBy;
}

/**
 * Carga `groupBy` persistido del usuario y expone un setter que además hace
 * PATCH con `Idempotency-Key` (sólo al cambiar el filtro, no en otros eventos UX).
 */
export function useBacklogGroupByPref() {
	const [groupBy, setGroupBy] = useState<GroupBy>("none");
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const res = await identityPmApi.getMyPreferences();
			if (cancelled) return;
			const pmPrefs = (res.success && res.data?.preferences?.[PM_PREFS_KEY]) as PmPreferences | undefined;
			if (pmPrefs?.backlogGroupBy) setGroupBy(pmPrefs.backlogGroupBy);
			setLoaded(true);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const updateGroupBy = (next: GroupBy) => {
		setGroupBy(next);
		identityPmApi.updateMyPreferences({ [PM_PREFS_KEY]: { backlogGroupBy: next } });
	};

	return { groupBy, updateGroupBy, loaded };
}
