import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityApi, type Group, type Role, type Permission, type IdentityScope, type Organization } from "../utils/identity-api.ts";
import { Scope, canWrite, canUpdate, canDelete } from "../utils/permissions.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { PermissionEditor } from "../components/PermissionEditor/index.ts";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal.tsx";
import { FormModalFooter } from "../components/FormModalFooter.tsx";
import { RolePicker } from "../components/RolePicker.tsx";
import { MembersModal } from "../components/MembersModal.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";

interface GroupsViewProps {
	readonly scopes: IdentityScope[];
	readonly orgId?: string;
	readonly isAdmin?: boolean;
}

export function GroupsView({ scopes, orgId, isAdmin }: GroupsViewProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [groups, setGroups] = useState<Group[]>([]);
	const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
	const [allRoles, setAllRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<Group | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<Group | null>(null);
	const [membersModal, setMembersModal] = useState<Group | null>(null);
	const [orgMap, setOrgMap] = useState<Map<string, string>>(new Map());

	// Form state
	const [formName, setFormName] = useState("");
	const [formDescription, setFormDescription] = useState("");
	const [formRoleIds, setFormRoleIds] = useState<string[]>([]);
	const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
	const [submitting, setSubmitting] = useState(false);

	const writable = canWrite(scopes, Scope.GROUPS);
	const updatable = canUpdate(scopes, Scope.GROUPS);
	const deletable = canDelete(scopes, Scope.GROUPS);

	const editModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setModalOpen(false));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		const promises: Promise<any>[] = [identityApi.listGroups(orgId), identityApi.listRoles(orgId)];
		if (isAdmin && !orgId) promises.push(identityApi.listOrganizations());
		const [groupsRes, rolesRes, orgsRes] = await Promise.all(promises);
		if (groupsRes.success && groupsRes.data) {
			setGroups(groupsRes.data);
			setFilteredGroups(groupsRes.data);
		}
		if (rolesRes.success && rolesRes.data) setAllRoles(rolesRes.data);
		if (orgsRes?.success && orgsRes.data) {
			setOrgMap(new Map((orgsRes.data as Organization[]).map((o) => [o.orgId, o.slug])));
		}
		setLoading(false);
	}, [orgId, isAdmin]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleSearch = (query: string) => {
		if (!query) {
			setFilteredGroups(groups);
			return;
		}
		const q = query.toLowerCase();
		setFilteredGroups(groups.filter((g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)));
	};

	const getRoleName = (roleId: string) => {
		const role = allRoles.find((r) => r.id === roleId);
		return role?.name || roleId;
	};

	const toggleRole = (roleId: string) => {
		setFormRoleIds((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
	};

	const openCreateModal = () => {
		setEditingGroup(null);
		setFormName("");
		setFormDescription("");
		setFormRoleIds([]);
		setFormPermissions([]);
		setModalOpen(true);
	};

	const openEditModal = (group: Group) => {
		setEditingGroup(group);
		setFormName(group.name);
		setFormDescription(group.description);
		setFormRoleIds([...group.roleIds]);
		setFormPermissions(group.permissions ? [...group.permissions] : []);
		setModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearErrors();
		setSubmitting(true);

		const payload = {
			name: formName,
			description: formDescription,
			roleIds: formRoleIds,
			permissions: formPermissions,
		};

		if (editingGroup) {
			const result = await identityApi.updateGroup(editingGroup.id, payload);
			if (result.success) {
				setModalOpen(false);
				loadData();
			}
		} else {
			const result = await identityApi.createGroup(payload);
			if (result.success) {
				setModalOpen(false);
				loadData();
			}
		}
		setSubmitting(false);
	};

	const handleDelete = async () => {
		if (!deleteConfirm) return;
		clearErrors();
		const result = await identityApi.deleteGroup(deleteConfirm.id);
		if (result.success) {
			setDeleteConfirm(null);
			loadData();
		}
	};

	const columns: Column<Group>[] = [
		{ key: "name", label: t("groups.name") },
		{ key: "description", label: t("groups.description") },
		{
			key: "roleIds",
			label: t("groups.roles"),
			render: (g) => (
				<div className="flex flex-wrap gap-1">
					{g.roleIds.length === 0 ? (
						<span className="text-muted text-xs">{t("groups.noRoles")}</span>
					) : (
						g.roleIds.slice(0, 3).map((rid) => (
							<adc-badge key={rid} color="blue" size="sm">
								{getRoleName(rid)}
							</adc-badge>
						))
					)}
					{g.roleIds.length > 3 && (
						<adc-badge color="gray" size="sm">
							+{g.roleIds.length - 3}
						</adc-badge>
					)}
				</div>
			),
		},
		...(isAdmin && !orgId
			? [
					{
						key: "orgId" as keyof Group,
						label: t("common.organization"),
						render: (g: Group) =>
							g.orgId ? (
								<adc-badge color="indigo" size="sm">
									{orgMap.get(g.orgId) || g.orgId}
								</adc-badge>
							) : (
								<span className="text-muted text-xs">—</span>
							),
					} as Column<Group>,
				]
			: []),
	];

	return (
		<>
			<DataTable
				columns={columns}
				data={filteredGroups}
				loading={loading}
				searchPlaceholder={t("groups.searchPlaceholder")}
				onSearch={handleSearch}
				onAdd={writable ? openCreateModal : undefined}
				addLabel={t("groups.addGroup")}
				keyExtractor={(g) => g.id}
				emptyMessage={t("groups.noGroups")}
				actions={
					updatable || deletable
						? (group) => (
								<>
									{updatable && (
										<>
											<adc-button-rounded aria-label={t("groups.members")} onClick={() => setMembersModal(group)}>
												<adc-icon-members />
											</adc-button-rounded>
											<adc-button-rounded aria-label={t("common.edit")} onClick={() => openEditModal(group)}>
												<adc-icon-edit />
											</adc-button-rounded>
										</>
									)}
									{deletable && (
										<adc-button-rounded
											variant="danger"
											aria-label={t("common.delete")}
											onClick={() => setDeleteConfirm(group)}
										>
											<adc-icon-trash />
										</adc-button-rounded>
									)}
								</>
							)
						: undefined
				}
			/>

			{/* Create/Edit Modal */}
			{modalOpen && (
				<adc-modal ref={editModalRef} open modalTitle={editingGroup ? t("groups.editGroup") : t("groups.addGroup")} size="lg">
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("groups.name")}</label>
							<adc-input
								value={formName}
								placeholder={t("groups.namePlaceholder")}
								onInput={(e: any) => setFormName(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("groups.description")}</label>
							<adc-input
								value={formDescription}
								placeholder={t("groups.descriptionPlaceholder")}
								onInput={(e: any) => setFormDescription(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("groups.roles")}</label>
							<RolePicker roles={allRoles} selectedIds={formRoleIds} onToggle={toggleRole} />
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("permissions.directTitle")}</label>
							<p className="text-xs text-muted mb-2">{t("permissions.directHintGroup")}</p>
							<PermissionEditor permissions={formPermissions} onChange={setFormPermissions} />
						</div>
						<FormModalFooter onCancel={() => setModalOpen(false)} submitting={submitting} />
					</form>
				</adc-modal>
			)}

			{membersModal && (
				<MembersModal
					title={t("groups.manageMembers", { name: membersModal.name })}
					searchPlaceholder={t("groups.searchUserPlaceholder")}
					noMembersText={t("groups.noMembers")}
					entityId={membersModal.id}
					onClose={() => setMembersModal(null)}
					fetchMembers={async (id) => {
						const res = await identityApi.listGroupMembers(id);
						return res.success && res.data ? res.data : [];
					}}
					onAddMember={async (id, userId) => {
						const result = await identityApi.addUserToGroup(id, userId);
						return result.success;
					}}
					onRemoveMember={async (id, userId) => {
						const result = await identityApi.removeUserFromGroup(id, userId);
						return result.success;
					}}
				/>
			)}

			{deleteConfirm && (
				<DeleteConfirmModal
					message={t("groups.deleteConfirm", { name: deleteConfirm.name })}
					onClose={() => setDeleteConfirm(null)}
					onConfirm={handleDelete}
				/>
			)}
		</>
	);
}
