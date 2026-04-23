/**
 * Límites de Project Manager por tier de plataforma.
 * El tier se resuelve a nivel cuenta (ver `@common/types/tiers`).
 */

import type { AccountTier } from "../tiers.ts";

interface PMTierLimits {
	/** Proyectos privados que un usuario puede crear (visibility=private). */
	maxPrivateProjectsPerUser: number;
	/** Proyectos que una organización puede contener. */
	maxProjectsPerOrg: number;
	/** Issues máximos por proyecto. */
	maxIssuesPerProject: number;
	/** Sprints máximos por proyecto. */
	maxSprintsPerProject: number;
	/** Milestones máximos por proyecto. */
	maxMilestonesPerProject: number;
}

const LIMITS: Record<AccountTier, PMTierLimits> = {
	free: {
		maxPrivateProjectsPerUser: 2,
		maxProjectsPerOrg: 2,
		maxIssuesPerProject: 30,
		maxSprintsPerProject: 2,
		maxMilestonesPerProject: 2,
	},
};

export function getPMTierLimits(tier: AccountTier = "free"): PMTierLimits {
	return LIMITS[tier];
}
