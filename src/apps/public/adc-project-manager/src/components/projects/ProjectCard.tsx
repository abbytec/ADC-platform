import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import { canDelete, Scope } from "../../utils/permissions.ts";

interface Props {
	project: Project;
	perms: Permission[];
	onOpen: (project: Project) => void;
	onDelete: (id: string) => void;
}

export function ProjectCard({ project, perms, onOpen, onDelete }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	return (
		<adc-card class="p-4 flex flex-col gap-2">
			<div className="flex justify-between items-start gap-2">
				<div>
					<h3 className="font-heading text-lg font-semibold text-text">{project.name}</h3>
					<p className="text-xs text-muted font-mono">{project.slug}</p>
				</div>
				{project.orgId == null && (
					<adc-badge color="indigo" size="sm">
						{t("projects.globalProject")}
					</adc-badge>
				)}
			</div>
			{project.description && <p className="text-sm text-muted line-clamp-2">{project.description}</p>}
			<div className="flex flex-wrap gap-2 text-xs">
				<adc-badge color="gray" size="sm">
					{t("projects.visibility")}: {project.visibility}
				</adc-badge>
				<adc-badge color="gray" size="sm">
					{t("projects.issueCounter")}: {project.issueCounter}
				</adc-badge>
			</div>
			<div className="flex gap-2 mt-auto pt-2">
				<adc-button variant="accent" onClick={() => onOpen(project)}>
					{t("common.open")}
				</adc-button>
				{canDelete(perms, Scope.PROJECTS) && (
					<adc-button variant="accent" onClick={() => onDelete(project.id)}>
						{t("common.delete")}
					</adc-button>
				)}
			</div>
		</adc-card>
	);
}
