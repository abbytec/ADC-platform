import { useState } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import { canUpdate, Scope } from "../utils/permissions.ts";
import { GeneralSection } from "../components/settings/GeneralSection.tsx";
import { MembersSection } from "../components/settings/MembersSection.tsx";
import { ColumnsSection } from "../components/settings/ColumnsSection.tsx";
import { CustomFieldsSection } from "../components/settings/CustomFieldsSection.tsx";
import { LinkTypesSection } from "../components/settings/LinkTypesSection.tsx";
import { PrioritySection } from "../components/settings/PrioritySection.tsx";
import { WipLimitsSection } from "../components/settings/WipLimitsSection.tsx";

interface Props {
	project: Project;
	perms: Permission[];
	onChanged: () => void | Promise<void>;
}

type SettingsTab = "general" | "members" | "columns" | "customFields" | "linkTypes" | "priority" | "wip";

export function ProjectSettingsView({ project, perms, onChanged }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const [tab, setTab] = useState<SettingsTab>("general");

	const canEditProject = canUpdate(perms, Scope.PROJECTS);
	const canEditSettings = canUpdate(perms, Scope.SETTINGS);
	const canEditCustomFields = canUpdate(perms, Scope.CUSTOM_FIELDS);

	const tabs: Array<{ id: SettingsTab; label: string; enabled: boolean }> = [
		{ id: "general", label: t("settings.generalTab"), enabled: true },
		{ id: "members", label: t("settings.membersTab"), enabled: canEditProject },
		{ id: "columns", label: t("settings.columnsTab"), enabled: canEditSettings },
		{ id: "customFields", label: t("settings.customFieldsTab"), enabled: canEditCustomFields },
		{ id: "linkTypes", label: t("settings.linkTypesTab"), enabled: canEditSettings },
		{ id: "priority", label: t("settings.priorityTab"), enabled: canEditSettings },
		{ id: "wip", label: t("settings.wipTab"), enabled: canEditSettings },
	];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-1 border-b border-border">
				{tabs.map((x) => (
					<button
						key={x.id}
						type="button"
						disabled={!x.enabled}
						onClick={() => setTab(x.id)}
						className={`px-3 py-1.5 text-sm rounded-t-md transition-colors ${
							tab === x.id ? "bg-surface border border-b-transparent border-border text-text" : "text-muted hover:text-text"
						} ${!x.enabled ? "opacity-40 cursor-not-allowed" : ""}`}
					>
						{x.label}
					</button>
				))}
			</div>
			<div className="pt-2">
				{tab === "general" && <GeneralSection project={project} canEdit={canEditProject} onSaved={onChanged} />}
				{tab === "members" && <MembersSection project={project} canEdit={canEditProject} onSaved={onChanged} />}
				{tab === "columns" && <ColumnsSection project={project} canEdit={canEditSettings} onSaved={onChanged} />}
				{tab === "customFields" && <CustomFieldsSection project={project} canEdit={canEditCustomFields} onSaved={onChanged} />}
				{tab === "linkTypes" && <LinkTypesSection project={project} canEdit={canEditSettings} onSaved={onChanged} />}
				{tab === "priority" && <PrioritySection project={project} canEdit={canEditSettings} onSaved={onChanged} />}
				{tab === "wip" && <WipLimitsSection project={project} canEdit={canEditSettings} onSaved={onChanged} />}
			</div>
		</div>
	);
}
