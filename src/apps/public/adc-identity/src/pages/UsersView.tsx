import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityApi } from "../utils/identity-api.ts";
import type { Organization, Permission, Role, User } from "@common/types/identity/index.d.ts";
import { Scope, canWrite, canUpdate, canDelete } from "../utils/permissions.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { PermissionEditor } from "../components/PermissionEditor/index.ts";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal.tsx";
import { FormModalFooter } from "../components/FormModalFooter.tsx";
import { RolePicker } from "../components/RolePicker.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";
import { RowActions } from "../components/RowActions.tsx";

interface UsersViewProps {
	readonly scopes: Permission[];
	readonly orgId?: string;
	readonly isAdmin?: boolean;
	readonly isTokenOrgContext?: boolean;
}

export function UsersView({ scopes, orgId, isAdmin, isTokenOrgContext }: UsersViewProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [users, setUsers] = useState<User[]>([]);
	const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
	const [roles, setRoles] = useState<Role[]>([]);
	const [pickerRoles, setPickerRoles] = useState<Role[]>([]);
	const [orgMap, setOrgMap] = useState<Map<string, string>>(new Map());
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

	// Form state
	const [formUsername, setFormUsername] = useState("");
	const [formPassword, setFormPassword] = useState("");
	const [formEmail, setFormEmail] = useState("");
	const [formRoleIds, setFormRoleIds] = useState<string[]>([]);
	const [formIsActive, setFormIsActive] = useState(true);
	const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
	const [submitting, setSubmitting] = useState(false);

	const writable = canWrite(scopes, Scope.USERS);
	const updatable = canUpdate(scopes, Scope.USERS);
	const deletable = canDelete(scopes, Scope.USERS);

	// Ref callbacks for Stencil web component events (React 19 lowercases event names)
	const editModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setModalOpen(false));
	}, []);
	const toggleRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcChange", (e: Event) => setFormIsActive((e as CustomEvent<boolean>).detail));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		const promises: Promise<any>[] = [identityApi.listUsers(orgId)];
		if (isAdmin && !orgId) promises.push(identityApi.listOrganizations());
		const [usersRes, orgsRes] = await Promise.all(promises);

		if (usersRes.success && usersRes.data) {
			setUsers(usersRes.data.users ?? []);
			setFilteredUsers(usersRes.data.users ?? []);
			setRoles(usersRes.data.roles ?? []);
		}
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
			setFilteredUsers(users);
			return;
		}
		const q = query.toLowerCase();
		setFilteredUsers(users.filter((u) => u.username.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)));
	};

	const getRoleName = (roleId: string) => {
		const role = roles.find((r) => r.id === roleId);
		return role?.name || t("errors.ROLE_NOT_FOUND");
	};

	/** Determina si un rol es global o de org para mostrar badge */
	const getRoleScope = (roleId: string): "global" | "org" | null => {
		const role = roles.find((r) => r.id === roleId);
		if (!role) return null;
		return role.orgId ? "org" : "global";
	};

	const getVisibleRoleIds = (user: User): string[] => {
		if (!orgId) return user.roleIds;
		const membership = user.orgMemberships?.find((item) => item.orgId === orgId);
		return Array.from(new Set([...(user.roleIds || []), ...(membership?.roleIds || [])]));
	};

	const getEditableRoleIds = (user: User): string[] => {
		if (!orgId) return user.roleIds;
		const membership = user.orgMemberships?.find((item) => item.orgId === orgId);
		return membership?.roleIds || [];
	};

	const loadPickerRoles = useCallback(async () => {
		const rolesRes = await identityApi.listRoles(orgId);
		if (rolesRes.success && rolesRes.data) {
			setPickerRoles(rolesRes.data);
		}
	}, [orgId]);

	const openCreateModal = async () => {
		setEditingUser(null);
		setFormUsername("");
		setFormPassword("");
		setFormEmail("");
		setFormRoleIds([]);
		setFormIsActive(true);
		setFormPermissions([]);
		await loadPickerRoles();
		setModalOpen(true);
	};

	const openEditModal = async (user: User) => {
		setEditingUser(user);
		setFormUsername(user.username);
		setFormPassword("");
		setFormEmail(user.email || "");
		setFormRoleIds(getEditableRoleIds(user));
		setFormIsActive(user.isActive);
		setFormPermissions(user.permissions ? [...user.permissions] : []);
		await loadPickerRoles();
		setModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearErrors();
		setSubmitting(true);

		if (editingUser) {
			const result = await identityApi.updateUser(
				editingUser.id,
				orgId
					? {
							roleIds: formRoleIds,
						}
					: {
							username: formUsername,
							email: formEmail || undefined,
							roleIds: formRoleIds,
							isActive: formIsActive,
							permissions: formPermissions,
						}
			);
			if (result.success) {
				setModalOpen(false);
				loadData();
			}
		} else {
			const result = await identityApi.createUser({
				username: formUsername,
				password: formPassword,
				roleIds: formRoleIds,
				orgId,
			});
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
		const result = await identityApi.deleteUser(deleteConfirm.id);
		if (result.success) {
			setDeleteConfirm(null);
			loadData();
		}
	};

	const toggleRoleId = (roleId: string) => {
		setFormRoleIds((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
	};

	const columns: Column<User>[] = [
		{ key: "username", label: t("users.username") },
		{ key: "email", label: t("users.email"), render: (u) => u.email || "—" },
		{
			key: "roleIds",
			label: t("users.roles"),
			render: (u) => (
				<div className="flex flex-wrap gap-1">
					{getVisibleRoleIds(u).map((rid) => {
						const scope = getRoleScope(rid);
						return (
							<adc-badge key={rid} color={scope === "org" ? "indigo" : "blue"} size="sm">
								{getRoleName(rid)}
							</adc-badge>
						);
					})}
					{getVisibleRoleIds(u).length === 0 && <span className="text-muted text-xs">—</span>}
				</div>
			),
		},
		{
			key: "isActive",
			label: t("users.status"),
			render: (u) => (
				<adc-badge color={u.isActive ? "green" : "red"} dot>
					{u.isActive ? t("users.active") : t("users.inactive")}
				</adc-badge>
			),
		},
		...(isAdmin && !orgId
			? [
					{
						key: "orgMemberships" as keyof User,
						label: t("common.organization"),
						render: (u: User) => (
							<div className="flex flex-wrap gap-1">
								{u.orgMemberships?.map((m) => (
									<adc-badge key={m.orgId} color="indigo" size="sm">
										{orgMap.get(m.orgId) || m.orgId}
									</adc-badge>
								))}
								{(!u.orgMemberships || u.orgMemberships.length === 0) && <span className="text-muted text-xs">—</span>}
							</div>
						),
					} as Column<User>,
				]
			: []),
		{
			key: "lastLogin",
			label: t("users.lastLogin"),
			render: (u) => (u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "—"),
		},
	];

	return (
		<>
			<DataTable
				columns={columns}
				data={filteredUsers}
				loading={loading}
				searchPlaceholder={t("users.searchPlaceholder")}
				onSearch={handleSearch}
				onAdd={writable ? openCreateModal : undefined}
				addLabel={t("users.addUser")}
				keyExtractor={(u) => u.id}
				emptyMessage={t("users.noUsers")}
				actions={(user) => (
					<RowActions
						item={user}
						canEdit={updatable}
						canDelete={deletable}
						onEdit={openEditModal}
						onDelete={setDeleteConfirm}
						editLabel={t("common.edit")}
						deleteLabel={t("common.delete")}
					/>
				)}
			/>

			{/* Create/Edit Modal */}
			{modalOpen && (
				<adc-modal ref={editModalRef} open modalTitle={editingUser ? t("users.editUser") : t("users.addUser")} size="lg">
					<form onSubmit={handleSubmit} className="space-y-4">
						{(!isTokenOrgContext || !editingUser) && (
							<div>
								<label className="block text-sm font-medium mb-1 text-text">{t("users.username")}</label>
								<adc-input
									inputId="username"
									value={formUsername}
									placeholder={t("users.usernamePlaceholder")}
									onInput={(e: any) => setFormUsername(e.target.value)}
								/>
							</div>
						)}

						{!editingUser && (
							<div>
								<label className="block text-sm font-medium mb-1 text-text">{t("users.password")}</label>
								<adc-input
									inputId="password"
									type="password"
									value={formPassword}
									placeholder="••••••••"
									onInput={(e: any) => setFormPassword(e.target.value)}
								/>
							</div>
						)}

						{!isTokenOrgContext && (
							<div>
								<label className="block text-sm font-medium mb-1 text-text">{t("users.email")}</label>
								<adc-input
									inputId="email"
									type="email"
									value={formEmail}
									placeholder="user@example.com"
									onInput={(e: any) => setFormEmail(e.target.value)}
								/>
							</div>
						)}

						{editingUser && !isTokenOrgContext && (
							<div>
								<label className="block text-sm font-medium mb-1 text-text">{t("users.status")}</label>
								<adc-toggle
									ref={toggleRef}
									checked={formIsActive}
									label={formIsActive ? t("users.active") : t("users.inactive")}
								/>
							</div>
						)}

						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("users.roles")}</label>
							<RolePicker roles={pickerRoles} selectedIds={formRoleIds} onToggle={toggleRoleId} />
						</div>

						{editingUser && !isTokenOrgContext && (
							<div>
								<label className="block text-sm font-medium mb-1 text-text">{t("permissions.directTitle")}</label>
								<p className="text-xs text-muted mb-2">{t("permissions.directHint")}</p>
								<PermissionEditor permissions={formPermissions} onChange={setFormPermissions} />
							</div>
						)}

						<FormModalFooter onCancel={() => setModalOpen(false)} submitting={submitting} />
					</form>
				</adc-modal>
			)}

			{deleteConfirm && (
				<DeleteConfirmModal
					message={t("users.deleteConfirm", { name: deleteConfirm.username })}
					onClose={() => setDeleteConfirm(null)}
					onConfirm={handleDelete}
				/>
			)}
		</>
	);
}
