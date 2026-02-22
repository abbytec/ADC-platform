import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityApi, type User, type Role, type Permission, type IdentityScope } from "../utils/identity-api.ts";
import { Scope, canWrite, canUpdate, canDelete } from "../utils/permissions.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { PermissionEditor } from "../components/PermissionEditor.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";

interface UsersViewProps {
	readonly scopes: IdentityScope[];
}

export function UsersView({ scopes }: UsersViewProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [users, setUsers] = useState<User[]>([]);
	const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
	const [roles, setRoles] = useState<Role[]>([]);
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
	const [roleSearch, setRoleSearch] = useState("");

	const writable = canWrite(scopes, Scope.USERS);
	const updatable = canUpdate(scopes, Scope.USERS);
	const deletable = canDelete(scopes, Scope.USERS);

	// Ref callbacks for Stencil web component events (React 19 lowercases event names)
	const editModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setModalOpen(false));
	}, []);
	const deleteModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setDeleteConfirm(null));
	}, []);
	const toggleRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcChange", (e: Event) => setFormIsActive((e as CustomEvent<boolean>).detail));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		const [usersRes, rolesRes] = await Promise.all([identityApi.listUsers(), identityApi.listRoles()]);

		if (usersRes.success && usersRes.data) {
			setUsers(usersRes.data);
			setFilteredUsers(usersRes.data);
		}
		if (rolesRes.success && rolesRes.data) {
			setRoles(rolesRes.data);
		}
		setLoading(false);
	}, []);

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
		return role?.name || roleId;
	};

	const openCreateModal = () => {
		setEditingUser(null);
		setFormUsername("");
		setFormPassword("");
		setFormEmail("");
		setFormRoleIds([]);
		setFormIsActive(true);
		setFormPermissions([]);
		setRoleSearch("");
		setModalOpen(true);
	};

	const openEditModal = (user: User) => {
		setEditingUser(user);
		setFormUsername(user.username);
		setFormPassword("");
		setFormEmail(user.email || "");
		setFormRoleIds(user.roleIds);
		setFormIsActive(user.isActive);
		setFormPermissions(user.permissions ? [...user.permissions] : []);
		setRoleSearch("");
		setModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearErrors();
		setSubmitting(true);

		if (editingUser) {
			const result = await identityApi.updateUser(editingUser.id, {
				username: formUsername,
				email: formEmail || undefined,
				roleIds: formRoleIds,
				isActive: formIsActive,
				permissions: formPermissions,
			});
			if (result.success) {
				setModalOpen(false);
				loadData();
			}
		} else {
			const result = await identityApi.createUser({
				username: formUsername,
				password: formPassword,
				roleIds: formRoleIds,
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
					{u.roleIds.map((rid) => (
						<adc-badge key={rid} color="blue" size="sm">
							{getRoleName(rid)}
						</adc-badge>
					))}
					{u.roleIds.length === 0 && <span className="text-muted text-xs">—</span>}
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
				actions={
					updatable || deletable
						? (user) => (
								<>
									{updatable && (
										<adc-button-rounded aria-label={t("common.edit")} onClick={() => openEditModal(user)}>
											<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
												<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
											</svg>
										</adc-button-rounded>
									)}
									{deletable && (
										<adc-button-rounded
											variant="danger"
											aria-label={t("common.delete")}
											onClick={() => setDeleteConfirm(user)}
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
				<adc-modal ref={editModalRef} open modalTitle={editingUser ? t("users.editUser") : t("users.addUser")} size="lg">
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("users.username")}</label>
							<adc-input
								inputId="username"
								value={formUsername}
								placeholder={t("users.usernamePlaceholder")}
								onInput={(e: any) => setFormUsername(e.target.value)}
							/>
						</div>

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

						{editingUser && (
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
							<adc-search-input
								placeholder={t("users.searchRoles")}
								debounce={250}
								ref={(el: HTMLElement | null) => {
									if (el) el.addEventListener("adcInput", (e: Event) => setRoleSearch((e as CustomEvent<string>).detail));
								}}
							/>
							<div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
								{roles
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
											ref={(el: HTMLElement | null) => el?.addEventListener("adcToggle", () => toggleRoleId(role.id))}
										>
											{role.name}
										</adc-toggle-badge>
									))}
							</div>
						</div>

						{editingUser && (
							<div>
								<label className="block text-sm font-medium mb-1 text-text">{t("permissions.directTitle")}</label>
								<p className="text-xs text-muted mb-2">{t("permissions.directHint")}</p>
								<PermissionEditor permissions={formPermissions} onChange={setFormPermissions} />
							</div>
						)}

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

			{/* Delete Confirmation Modal */}
			{deleteConfirm && (
				<adc-modal ref={deleteModalRef} open modalTitle={t("common.confirmDelete")} size="sm">
					<p className="text-text">{t("users.deleteConfirm", { username: deleteConfirm.username })}</p>
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
