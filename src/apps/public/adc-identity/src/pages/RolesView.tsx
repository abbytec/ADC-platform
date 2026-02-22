import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityApi, type Role, type Permission, type IdentityScope } from "../utils/identity-api.ts";
import { Scope, canWrite, canUpdate, canDelete } from "../utils/permissions.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { PermissionEditor } from "../components/PermissionEditor.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";

interface RolesViewProps {
	readonly scopes: IdentityScope[];
}

export function RolesView({ scopes }: RolesViewProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [roles, setRoles] = useState<Role[]>([]);
	const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

	// Form state
	const [formName, setFormName] = useState("");
	const [formDescription, setFormDescription] = useState("");
	const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
	const [submitting, setSubmitting] = useState(false);

	const writable = canWrite(scopes, Scope.ROLES);
	const updatable = canUpdate(scopes, Scope.ROLES);
	const deletable = canDelete(scopes, Scope.ROLES);

	const editModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setModalOpen(false));
	}, []);
	const deleteModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setDeleteConfirm(null));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		const result = await identityApi.listRoles();
		if (result.success && result.data) {
			setRoles(result.data);
			setFilteredRoles(result.data);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleSearch = (query: string) => {
		if (!query) {
			setFilteredRoles(roles);
			return;
		}
		const q = query.toLowerCase();
		setFilteredRoles(roles.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)));
	};

	const openCreateModal = () => {
		setEditingRole(null);
		setFormName("");
		setFormDescription("");
		setFormPermissions([]);
		setModalOpen(true);
	};

	const openEditModal = (role: Role) => {
		setEditingRole(role);
		setFormName(role.name);
		setFormDescription(role.description);
		setFormPermissions([...role.permissions]);
		setModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearErrors();
		setSubmitting(true);

		if (editingRole) {
			const result = await identityApi.updateRole(editingRole.id, {
				name: formName,
				description: formDescription,
				permissions: formPermissions,
			});
			if (result.success) {
				setModalOpen(false);
				loadData();
			}
		} else {
			const result = await identityApi.createRole({
				name: formName,
				description: formDescription,
				permissions: formPermissions,
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
		const result = await identityApi.deleteRole(deleteConfirm.id);
		if (result.success) {
			setDeleteConfirm(null);
			loadData();
		}
	};

	const columns: Column<Role>[] = [
		{ key: "name", label: t("roles.name") },
		{ key: "description", label: t("roles.description") },
		{
			key: "isCustom",
			label: t("roles.type"),
			render: (r) => (
				<adc-badge color={r.isCustom ? "purple" : "teal"} size="sm">
					{r.isCustom ? t("roles.custom") : t("roles.predefined")}
				</adc-badge>
			),
		},
		{
			key: "permissions",
			label: t("roles.permissions"),
			render: (r) => (
				<span className="text-muted text-xs">
					{r.permissions.length} {t("roles.permissionCount")}
				</span>
			),
		},
	];

	return (
		<>
			<DataTable
				columns={columns}
				data={filteredRoles}
				loading={loading}
				searchPlaceholder={t("roles.searchPlaceholder")}
				onSearch={handleSearch}
				onAdd={writable ? openCreateModal : undefined}
				addLabel={t("roles.addRole")}
				keyExtractor={(r) => r.id}
				emptyMessage={t("roles.noRoles")}
				actions={
					updatable || deletable
						? (role) => (
								<>
									{updatable && role.isCustom && (
										<adc-button-rounded aria-label={t("common.edit")} onClick={() => openEditModal(role)}>
											<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
												<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
											</svg>
										</adc-button-rounded>
									)}
									{deletable && role.isCustom && (
										<adc-button-rounded variant="danger" aria-label={t("common.delete")} onClick={() => setDeleteConfirm(role)}>
											<svg
												className="w-4 h-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
											>
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
				<adc-modal ref={editModalRef} open modalTitle={editingRole ? t("roles.editRole") : t("roles.addRole")} size="lg">
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("roles.name")}</label>
							<adc-input
								value={formName}
								placeholder={t("roles.namePlaceholder")}
								onInput={(e: any) => setFormName(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("roles.description")}</label>
							<adc-input
								value={formDescription}
								placeholder={t("roles.descriptionPlaceholder")}
								onInput={(e: any) => setFormDescription(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("permissions.title")}</label>
							<PermissionEditor
								permissions={formPermissions}
								onChange={setFormPermissions}
								disabled={editingRole ? !editingRole.isCustom : false}
							/>
							{editingRole && !editingRole.isCustom && (
								<p className="text-xs text-muted mt-1">{t("permissions.predefinedReadonly")}</p>
							)}
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

			{/* Delete Confirmation */}
			{deleteConfirm && (
				<adc-modal ref={deleteModalRef} open modalTitle={t("common.confirmDelete")} size="sm">
					<p className="text-text">{t("roles.deleteConfirm", { name: deleteConfirm.name })}</p>
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
