import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import { canUpdate, canDelete, Scope } from "../../utils/permissions.ts";

const STATUS_COLORS = { planned: "gray", active: "green", completed: "blue" } as const;

interface Props {
	sprint: Sprint;
	doneCount: number;
	totalCount: number;
	scopes: Permission[];
	onStart: (id: string) => void;
	onComplete: (id: string) => void;
	onDelete: (id: string) => void;
}

export function SprintCard({ sprint, doneCount, totalCount, scopes, onStart, onComplete, onDelete }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	return (
		<adc-card class="p-4 flex items-center justify-between gap-3">
			<div>
				<h4 className="font-semibold text-text">{sprint.name}</h4>
				{sprint.goal && <p className="text-sm text-muted">{sprint.goal}</p>}
				<p className="text-xs text-muted mt-1">{t("sprints.issuesCount", { done: String(doneCount), total: String(totalCount) })}</p>
			</div>
			<div className="flex items-center gap-2">
				<adc-badge color={STATUS_COLORS[sprint.status as keyof typeof STATUS_COLORS] ?? "gray"} size="sm">
					{t(`sprints.${sprint.status}`)}
				</adc-badge>
				{canUpdate(scopes, Scope.SPRINTS) && sprint.status === "planned" && (
					<adc-button variant="accent" onClick={() => onStart(sprint.id)}>
						{t("sprints.start")}
					</adc-button>
				)}
				{canUpdate(scopes, Scope.SPRINTS) && sprint.status === "active" && (
					<adc-button variant="accent" onClick={() => onComplete(sprint.id)}>
						{t("sprints.complete")}
					</adc-button>
				)}
				{canDelete(scopes, Scope.SPRINTS) && (
					<adc-button variant="accent" onClick={() => onDelete(sprint.id)}>
						{t("common.delete")}
					</adc-button>
				)}
			</div>
		</adc-card>
	);
}
