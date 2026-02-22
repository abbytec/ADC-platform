import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityApi, type Group, type Role, type Permission, type IdentityScope } from "../utils/identity-api.ts";
import { Scope, canWrite, canUpdate, canDelete } from "../utils/permissions.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { PermissionEditor } from "../components/PermissionEditor.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";

interface GroupsViewProps {
	readonly scopes: IdentityScope[];
}

export function GroupsView({ scopes }: GroupsViewProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [groups, setGroups] = useState<Group[]>([]);
	const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
	const [allRoles, setAllRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<Group | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<Group | null>(null);
	const [membersModal, setMembersModal] = useState<Group | null>(null);

	// Form state
	const [formName, setFormName] = useState("");
	const [formDescription, setFormDescription] = useState("");
	const [formRoleIds, setFormRoleIds] = useState<string[]>([]);
	const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [roleSearch, setRoleSearch] = useState("");

	// Members state
	const [addingMember, setAddingMember] = useState(false);
	const [members, setMembers] = useState<import("../utils/identity-api.ts").User[]>([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [userSearchResults, setUserSearchResults] = useState<import("../utils/identity-api.ts").User[]>([]);
	const [userSearching, setUserSearching] = useState(false);

	const writable = canWrite(scopes, Scope.GROUPS);
	const updatable = canUpdate(scopes, Scope.GROUPS);
	const deletable = canDelete(scopes, Scope.GROUPS);

	const editModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setModalOpen(false));
	}, []);
	const membersModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setMembersModal(null));
	}, []);
	const deleteModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setDeleteConfirm(null));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		const [groupsRes, rolesRes] = await Promise.all([identityApi.listGroups(), identityApi.listRoles()]);
		if (groupsRes.success && groupsRes.data) {
			setGroups(groupsRes.data);
			setFilteredGroups(groupsRes.data);
		}
		if (rolesRes.success && rolesRes.data) setAllRoles(rolesRes.data);
		setLoading(false);
	}, []);

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
		setRoleSearch("");
		setModalOpen(true);
	};

	const openEditModal = (group: Group) => {
		setEditingGroup(group);
		setFormName(group.name);
		setFormDescription(group.description);
		setFormRoleIds([...group.roleIds]);
		setFormPermissions(group.permissions ? [...group.permissions] : []);
		setRoleSearch("");
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

	const loadMembers = useCallback(async (groupId: string) => {
		setLoadingMembers(true);
		const res = await identityApi.listGroupMembers(groupId);
		if (res.success && res.data) setMembers(res.data);
		setLoadingMembers(false);
	}, []);

	const openMembersModal = useCallback(
		(group: Group) => {
			setMembersModal(group);
			setUserSearchResults([]);
			loadMembers(group.id);
		},
		[loadMembers]
	);

	const handleAddMember = async (userId: string) => {
		if (!membersModal) return;
		clearErrors();
		setAddingMember(true);
		const result = await identityApi.addUserToGroup(membersModal.id, userId);
		if (result.success) {
			setUserSearchResults([]);
			loadMembers(membersModal.id);
		}
		setAddingMember(false);
	};

	const handleUserSearch = useCallback(async (query: string) => {
		if (!query || query.length < 2) {
			setUserSearchResults([]);
			return;
		}
		setUserSearching(true);
		const res = await identityApi.searchUsers(query);
		if (res.success && res.data) setUserSearchResults(res.data);
		setUserSearching(false);
	}, []);

	const userSearchRef = useCallback(
		(el: HTMLElement | null) => {
			if (el) el.addEventListener("adcInput", (e: Event) => handleUserSearch((e as CustomEvent<string>).detail));
		},
		[handleUserSearch]
	);

	const handleRemoveMember = async (userId: string) => {
		if (!membersModal) return;
		clearErrors();
		const result = await identityApi.removeUserFromGroup(membersModal.id, userId);
		if (result.success) loadMembers(membersModal.id);
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
											<adc-button-rounded aria-label={t("groups.members")} onClick={() => openMembersModal(group)}>
												<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
													<circle cx="9" cy="7" r="4" />
													<path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
												</svg>
											</adc-button-rounded>
											<adc-button-rounded aria-label={t("common.edit")} onClick={() => openEditModal(group)}>
												<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
													<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
												</svg>
											</adc-button-rounded>
										</>
									)}
									{deletable && (
										<adc-button-rounded
											variant="danger"
											aria-label={t("common.delete")}
											onClick={() => setDeleteConfirm(group)}
										>
											<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
											</svg>
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
							<adc-search-input
								placeholder={t("users.searchRoles")}
								debounce={250}
								ref={(el: HTMLElement | null) => {
									if (el) el.addEventListener("adcInput", (e: Event) => setRoleSearch((e as CustomEvent<string>).detail));
								}}
							/>
							<div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
								{allRoles
									.filter((r) => {
										if (formRoleIds.includes(r.id)) return true;
										const q = roleSearch.trim().toLowerCase();
										if (q) return r.name.toLowerCase().includes(q);
										return !r.isCustom;
									})
									.map((role) => (
										<adc-toggle-badge
											key={role.id}
											active={formRoleIds.includes(role.id)}
											ref={(el: HTMLElement | null) => el?.addEventListener("adcToggle", () => toggleRole(role.id))}
										>
											{role.name}
										</adc-toggle-badge>
									))}
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("permissions.directTitle")}</label>
							<p className="text-xs text-muted mb-2">{t("permissions.directHintGroup")}</p>
							<PermissionEditor permissions={formPermissions} onChange={setFormPermissions} />
						</div>
						<div slot="footer" className="flex justify-end gap-2">
							<adc-button variant="accent" type="button" onClick={() => setModalOpen(false)}>
								{t("common.cancel")}
							</adc-button>
							<adc-button variant="primary" type="submit" disabled={submitting}>
								{submitting ? t("common.saving") : t("common.save")}
							</adc-button>
						</div>
					</form>
				</adc-modal>
			)}

			{/* Members Modal */}
			{membersModal && (
				<adc-modal ref={membersModalRef} open modalTitle={t("groups.manageMembers", { name: membersModal.name })} size="md">
					<div className="space-y-4">
						{/* User search */}
						<div className="relative">
							<adc-search-input ref={userSearchRef} placeholder={t("groups.searchUserPlaceholder")} debounce={350} />
							{(userSearchResults.length > 0 || userSearching) && (
								<div className="absolute z-20 left-0 right-0 mt-1 bg-background border border-surface rounded-xl shadow-lg max-h-48 overflow-y-auto">
									{userSearching ? (
										<div className="flex justify-center py-3">
											<adc-spinner />
										</div>
									) : (
										userSearchResults
											.filter((u) => !members.some((m) => m.id === u.id))
											.map((user) => (
												<button
													key={user.id}
													type="button"
													className="w-full text-left px-3 py-2 hover:bg-surface/50 transition-colors cursor-pointer flex items-center justify-between"
													onClick={() => handleAddMember(user.id)}
													disabled={addingMember}
												>
													<div>
														<span className="text-sm font-medium text-text">{user.username}</span>
														{user.email && <span className="text-xs text-muted ml-2">{user.email}</span>}
													</div>
													<svg
														className="w-4 h-4 text-primary shrink-0"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
													>
														<path d="M12 5v14M5 12h14" />
													</svg>
												</button>
											))
									)}
								</div>
							)}
						</div>

						{/* Member list */}
						{loadingMembers ? (
							<div className="flex justify-center py-4">
								<adc-spinner />
							</div>
						) : members.length === 0 ? (
							<p className="text-sm text-muted py-2">{t("groups.noMembers")}</p>
						) : (
							<ul className="divide-y divide-surface">
								{members.map((member) => (
									<li key={member.id} className="flex items-center justify-between py-2">
										<div>
											<span className="text-sm font-medium text-text">{member.username}</span>
											{member.email && <span className="text-xs text-muted ml-2">{member.email}</span>}
										</div>
										<adc-button-rounded
											variant="danger"
											aria-label={t("common.delete")}
											onClick={() => handleRemoveMember(member.id)}
										>
											<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M18 6L6 18M6 6l12 12" />
											</svg>
										</adc-button-rounded>
									</li>
								))}
							</ul>
						)}
					</div>
					<div slot="footer" className="flex justify-end">
						<adc-button variant="accent" onClick={() => setMembersModal(null)}>
							{t("common.close")}
						</adc-button>
					</div>
				</adc-modal>
			)}

			{/* Delete Confirmation */}
			{deleteConfirm && (
				<adc-modal ref={deleteModalRef} open modalTitle={t("common.confirmDelete")} size="sm">
					<p className="text-text">{t("groups.deleteConfirm", { name: deleteConfirm.name })}</p>
					<div slot="footer" className="flex justify-end gap-2">
						<adc-button variant="accent" onClick={() => setDeleteConfirm(null)}>
							{t("common.cancel")}
						</adc-button>
						<adc-button variant="primary" onClick={handleDelete}>
							{t("common.delete")}
						</adc-button>
					</div>
				</adc-modal>
			)}
		</>
	);
}
