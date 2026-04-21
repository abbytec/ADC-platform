import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { Issue, UrgencyImportance, Difficulty } from "@common/types/project-manager/Issue.ts";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import type { UpdateLogEntry } from "@common/types/project-manager/UpdateLogEntry.ts";
import type { CustomFieldValue } from "@common/types/project-manager/CustomField.ts";
import type { IssueLink } from "@common/types/project-manager/IssueLink.ts";
import { pmApi } from "../utils/pm-api.ts";
import { canUpdate, canWrite, Scope } from "../utils/permissions.ts";
import { UserPicker } from "./pickers/UserPicker.tsx";
import { GroupPicker } from "./pickers/GroupPicker.tsx";
import { CustomFieldsEditor } from "./pickers/CustomFieldsEditor.tsx";
import { IssueLinksEditor } from "./pickers/IssueLinksEditor.tsx";

interface Props {
	project: Project;
	issue: Issue | null;
	scopes: Permission[];
	sprints?: Sprint[];
	milestones?: Milestone[];
	onClose: () => void;
	onSaved: () => void | Promise<void>;
}

function toU(n: number): UrgencyImportance {
	const v = Math.max(0, Math.min(4, Math.round(n)));
	return v as UrgencyImportance;
}
function toD(n: number): Difficulty {
	if (!Number.isFinite(n) || n <= 0) return null;
	const v = Math.max(1, Math.min(5, Math.round(n)));
	return v as Difficulty;
}

export function IssueDialog({ project, issue, scopes, sprints = [], milestones = [], onClose, onSaved }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const isNew = !issue;
	const [form, setForm] = useState<{
		title: string;
		description: string;
		columnKey: string;
		sprintId: string;
		milestoneId: string;
		urgency: number;
		importance: number;
		difficulty: number;
		reason: string;
		assigneeIds: string[];
		assigneeGroupIds: string[];
		customFields: Record<string, CustomFieldValue>;
		linkedIssues: IssueLink[];
	}>({
		title: issue?.title ?? "",
		description: issue?.description ?? "",
		columnKey: issue?.columnKey ?? project.kanbanColumns.find((c) => c.isAuto)?.key ?? project.kanbanColumns[0]?.key ?? "todo",
		sprintId: issue?.sprintId ?? "",
		milestoneId: issue?.milestoneId ?? "",
		urgency: issue?.priority.urgency ?? 2,
		importance: issue?.priority.importance ?? 2,
		difficulty: (issue?.priority.difficulty ?? 3) as number,
		reason: "",
		assigneeIds: issue?.assigneeIds ?? [],
		assigneeGroupIds: issue?.assigneeGroupIds ?? [],
		customFields: issue?.customFields ?? {},
		linkedIssues: issue?.linkedIssues ?? [],
	});
	const [saving, setSaving] = useState(false);
	const [history, setHistory] = useState<UpdateLogEntry[]>([]);
	const [showHistory, setShowHistory] = useState(false);
	const [projectIssues, setProjectIssues] = useState<Issue[]>([]);

	const modalRef = useCallback(
		(el: HTMLElement | null) => {
			if (el) el.addEventListener("adcClose", onClose);
		},
		[onClose]
	);

	useEffect(() => {
		if (!issue) return;
		pmApi.getIssueHistory(issue.id).then((r) => {
			if (r.success && r.data) setHistory(r.data.updateLog);
		});
	}, [issue]);

	useEffect(() => {
		if (project.issueLinkTypes.length === 0) return;
		pmApi.listIssues(project.id).then((r) => {
			if (r.success && r.data) setProjectIssues(r.data.issues);
		});
	}, [project.id, project.issueLinkTypes.length]);

	const canEdit = isNew ? canWrite(scopes, Scope.ISSUES) : canUpdate(scopes, Scope.ISSUES);

	const save = async () => {
		setSaving(true);
		const payloadPriority = {
			urgency: toU(form.urgency),
			importance: toU(form.importance),
			difficulty: toD(form.difficulty),
		};
		if (isNew) {
			await pmApi.createIssue(project.id, {
				title: form.title,
				description: form.description,
				columnKey: form.columnKey,
				sprintId: form.sprintId || undefined,
				milestoneId: form.milestoneId || undefined,
				priority: payloadPriority,
				assigneeIds: form.assigneeIds,
				assigneeGroupIds: form.assigneeGroupIds,
				customFields: form.customFields,
				linkedIssues: form.linkedIssues,
			});
		} else if (issue) {
			await pmApi.updateIssue(issue.id, {
				title: form.title,
				description: form.description,
				columnKey: form.columnKey,
				sprintId: form.sprintId || undefined,
				milestoneId: form.milestoneId || undefined,
				priority: payloadPriority,
				assigneeIds: form.assigneeIds,
				assigneeGroupIds: form.assigneeGroupIds,
				customFields: form.customFields,
				linkedIssues: form.linkedIssues,
				reason: form.reason || undefined,
			});
		}
		setSaving(false);
		await onSaved();
	};

	return (
		<adc-modal ref={modalRef} open modalTitle={isNew ? t("issues.newIssue") : `${issue?.key} · ${t("common.edit")}`} size="lg">
			<div className="space-y-3 p-4">
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("issues.issueTitle")}</label>
					<adc-input value={form.title} onInput={(e: any) => setForm({ ...form, title: e.target.value })} disabled={!canEdit} />
				</div>
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("common.description")}</label>
					<adc-textarea
						value={form.description}
						onInput={(e: any) => setForm({ ...form, description: e.target.value })}
						disabled={!canEdit}
					/>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.urgency")}</label>
						<adc-input
							type="number"
							value={String(form.urgency)}
							onInput={(e: any) => setForm({ ...form, urgency: Number(e.target.value) })}
							disabled={!canEdit}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.impact")}</label>
						<adc-input
							type="number"
							value={String(form.importance)}
							onInput={(e: any) => setForm({ ...form, importance: Number(e.target.value) })}
							disabled={!canEdit}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.difficulty")}</label>
						<adc-input
							type="number"
							value={String(form.difficulty)}
							onInput={(e: any) => setForm({ ...form, difficulty: Number(e.target.value) })}
							disabled={!canEdit}
						/>
					</div>
				</div>
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("issues.column")}</label>
					<adc-combobox
						value={form.columnKey}
						clearable={false}
						options={JSON.stringify(project.kanbanColumns.map((c) => ({ label: c.name, value: c.key })))}
						onadcChange={(e: any) => setForm({ ...form, columnKey: e.detail })}
						disabled={!canEdit}
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.sprint")}</label>
						<adc-combobox
							value={form.sprintId}
							placeholder={t("issues.unassigned")}
							options={JSON.stringify(sprints.map((s) => ({ label: s.name, value: s.id })))}
							onadcChange={(e: any) => setForm({ ...form, sprintId: e.detail })}
							disabled={!canEdit}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.milestone")}</label>
						<adc-combobox
							value={form.milestoneId}
							placeholder={t("issues.unassigned")}
							options={JSON.stringify(milestones.map((m) => ({ label: m.name, value: m.id })))}
							onadcChange={(e: any) => setForm({ ...form, milestoneId: e.detail })}
							disabled={!canEdit}
						/>
					</div>
				</div>
				<UserPicker
					label={t("issues.assignees")}
					selectedIds={form.assigneeIds}
					onChange={(ids) => setForm({ ...form, assigneeIds: ids })}
					disabled={!canEdit}
				/>
				<GroupPicker
					label={t("issues.assigneeGroups")}
					selectedIds={form.assigneeGroupIds}
					orgId={project.orgId}
					onChange={(ids) => setForm({ ...form, assigneeGroupIds: ids })}
					disabled={!canEdit}
				/>
				<CustomFieldsEditor
					defs={project.customFieldDefs}
					values={form.customFields}
					onChange={(values) => setForm({ ...form, customFields: values })}
					disabled={!canEdit}
				/>
				{project.issueLinkTypes.length > 0 && (
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.links")}</label>
						<IssueLinksEditor
							linkTypes={project.issueLinkTypes}
							currentIssueId={issue?.id}
							allIssues={projectIssues}
							value={form.linkedIssues}
							onChange={(links) => setForm({ ...form, linkedIssues: links })}
							disabled={!canEdit}
						/>
					</div>
				)}
				{!isNew && canEdit && (
					<div>
						<label className="block text-sm font-medium mb-1 text-text">{t("issues.reason")}</label>
						<adc-input value={form.reason} onInput={(e: any) => setForm({ ...form, reason: e.target.value })} />
					</div>
				)}
				{!isNew && (
					<div>
						<adc-button variant="accent" onClick={() => setShowHistory((s) => !s)}>
							{t("issues.history")} ({history.length})
						</adc-button>
						{showHistory && (
							<ul className="mt-2 border border-border rounded p-2 max-h-60 overflow-auto text-xs space-y-1">
								{history.map((h, idx) => (
									<li key={idx} className="border-b border-border last:border-0 pb-1">
										<span className="font-mono text-muted">{new Date(h.at).toLocaleString()}</span>{" "}
										<span className="font-semibold">{h.field}</span>:{" "}
										<span className="text-muted">{JSON.stringify(h.oldValue)}</span> →{" "}
										<span>{JSON.stringify(h.newValue)}</span>
										{h.reason && <span className="block text-muted italic">“{h.reason}”</span>}
									</li>
								))}
								{history.length === 0 && <li className="text-muted">—</li>}
							</ul>
						)}
					</div>
				)}
				<div className="flex gap-2 justify-end pt-2">
					<adc-button variant="accent" onClick={onClose}>
						{t("common.cancel")}
					</adc-button>
					{canEdit && (
						<adc-button variant="primary" onClick={save} disabled={saving || !form.title}>
							{saving ? t("common.saving") : t("common.save")}
						</adc-button>
					)}
				</div>
			</div>
		</adc-modal>
	);
}
