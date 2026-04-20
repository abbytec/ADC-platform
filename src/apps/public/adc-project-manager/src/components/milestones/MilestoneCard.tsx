import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import { canDelete, Scope } from "../../utils/permissions.ts";

interface Props {
	milestone: Milestone;
	doneCount: number;
	totalCount: number;
	scopes: Permission[];
	onDelete: (id: string) => void;
}

export function MilestoneCard({ milestone, doneCount, totalCount, scopes, onDelete }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	return (
		<adc-card class="p-4 flex items-center justify-between gap-3">
			<div>
				<h4 className="font-semibold text-text">{milestone.name}</h4>
				{milestone.description && <p className="text-sm text-muted">{milestone.description}</p>}
				<p className="text-xs text-muted">
					{t("common.status")}: {milestone.status}
				</p>
				<p className="text-xs text-muted">{t("milestones.issuesCount", { done: String(doneCount), total: String(totalCount) })}</p>
			</div>
			<div className="flex items-center gap-2">
				{canDelete(scopes, Scope.MILESTONES) && (
					<adc-button variant="accent" onClick={() => onDelete(milestone.id)}>
						{t("common.delete")}
					</adc-button>
				)}
			</div>
		</adc-card>
	);
}
