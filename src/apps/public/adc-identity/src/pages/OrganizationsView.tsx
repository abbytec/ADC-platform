import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityApi, type Organization, type Region, type User, type IdentityScope } from "../utils/identity-api.ts";
import { Scope, canWrite, canUpdate, canDelete } from "../utils/permissions.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";

interface OrganizationsViewProps {
	readonly scopes: IdentityScope[];
}

const ORG_STATUSES = ["active", "inactive", "blocked"] as const;

const statusColors: Record<string, string> = {
	active: "green",
	inactive: "gray",
	blocked: "red",
};

export function OrganizationsView({ scopes }: OrganizationsViewProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [orgs, setOrgs] = useState<Organization[]>([]);
	const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([]);
	const [allRegions, setAllRegions] = useState<Region[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<Organization | null>(null);
	const [membersModal, setMembersModal] = useState<Organization | null>(null);

	// Form state
	const [formSlug, setFormSlug] = useState("");
	const [formRegion, setFormRegion] = useState("");
	const [formTier, setFormTier] = useState("");
	const [formStatus, setFormStatus] = useState<string>("active");
	const [submitting, setSubmitting] = useState(false);

	// Members state
	const [addingMember, setAddingMember] = useState(false);
	const [members, setMembers] = useState<User[]>([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
	const [userSearching, setUserSearching] = useState(false);

	const writable = canWrite(scopes, Scope.ORGANIZATIONS);
	const updatable = canUpdate(scopes, Scope.ORGANIZATIONS);
	const deletable = canDelete(scopes, Scope.ORGANIZATIONS);

	const editModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setModalOpen(false));
	}, []);
	const deleteModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setDeleteConfirm(null));
	}, []);
	const membersModalRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcClose", () => setMembersModal(null));
	}, []);

	const loadData = useCallback(async () => {
		setLoading(true);
		const [orgsRes, regionsRes] = await Promise.all([identityApi.listOrganizations(), identityApi.listRegions()]);
		if (orgsRes.success && orgsRes.data) {
			setOrgs(orgsRes.data);
			setFilteredOrgs(orgsRes.data);
		}
		if (regionsRes.success && regionsRes.data) setAllRegions(regionsRes.data);
		setLoading(false);
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleSearch = (query: string) => {
		if (!query) {
			setFilteredOrgs(orgs);
			return;
		}
		const q = query.toLowerCase();
		setFilteredOrgs(
			orgs.filter((o) => o.slug.toLowerCase().includes(q) || o.region.toLowerCase().includes(q) || o.tier?.toLowerCase().includes(q))
		);
	};

	const openCreateModal = () => {
		setEditingOrg(null);
		setFormSlug("");
		setFormRegion(allRegions[0]?.path || "");
		setFormTier("");
		setFormStatus("active");
		setModalOpen(true);
	};

	const openEditModal = (org: Organization) => {
		setEditingOrg(org);
		setFormSlug(org.slug);
		setFormRegion(org.region);
		setFormTier(org.tier || "");
		setFormStatus(org.status);
		setModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearErrors();
		setSubmitting(true);

		const payload = {
			slug: formSlug,
			region: formRegion,
			tier: formTier || undefined,
			status: formStatus as Organization["status"],
		};

		if (editingOrg) {
			const result = await identityApi.updateOrganization(editingOrg.orgId, payload);
			if (result.success) {
				setModalOpen(false);
				loadData();
			}
		} else {
			const result = await identityApi.createOrganization(payload);
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
		const result = await identityApi.deleteOrganization(deleteConfirm.orgId);
		if (result.success) {
			setDeleteConfirm(null);
			loadData();
		}
	};

	// ── Members management ───────────────────────────────────────────────────

	const loadMembers = useCallback(async (orgId: string) => {
		setLoadingMembers(true);
		const res = await identityApi.listOrgMembers(orgId);
		if (res.success && res.data) setMembers(res.data);
		setLoadingMembers(false);
	}, []);

	const openMembersModal = useCallback(
		(org: Organization) => {
			setMembersModal(org);
			setUserSearchResults([]);
			loadMembers(org.orgId);
		},
		[loadMembers]
	);

	const handleAddMember = async (userId: string) => {
		if (!membersModal) return;
		clearErrors();
		setAddingMember(true);
		const result = await identityApi.addUserToOrg(membersModal.orgId, userId);
		if (result.success) {
			loadMembers(membersModal.orgId);
			setUserSearchResults((prev) => prev.filter((u) => u.id !== userId));
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
		const result = await identityApi.removeUserFromOrg(membersModal.orgId, userId);
		if (result.success) loadMembers(membersModal.orgId);
	};

	const columns: Column<Organization>[] = [
		{ key: "slug", label: t("organizations.slug") },
		{ key: "region", label: t("organizations.region") },
		{
			key: "tier",
			label: t("organizations.tier"),
			render: (o) => <span className="text-text">{o.tier || "-"}</span>,
		},
		{
			key: "status",
			label: t("organizations.status"),
			render: (o) => (
				<adc-badge color={statusColors[o.status] || "gray"} size="sm" dot>
					{t(`organizations.statuses.${o.status}`)}
				</adc-badge>
			),
		},
		{
			key: "createdAt",
			label: t("organizations.createdAt"),
			render: (o) => <span className="text-muted text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "-"}</span>,
		},
	];

	return (
		<>
			<DataTable
				columns={columns}
				data={filteredOrgs}
				loading={loading}
				searchPlaceholder={t("organizations.searchPlaceholder")}
				onSearch={handleSearch}
				onAdd={writable ? openCreateModal : undefined}
				addLabel={t("organizations.addOrganization")}
				keyExtractor={(o) => o.orgId}
				emptyMessage={t("organizations.noOrganizations")}
				actions={
					updatable || deletable
						? (org) => (
								<>
									{updatable && (
										<>
											<adc-button-rounded aria-label={t("organizations.members")} onClick={() => openMembersModal(org)}>
												<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
													<circle cx="9" cy="7" r="4" />
													<path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
												</svg>
											</adc-button-rounded>
											<adc-button-rounded aria-label={t("common.edit")} onClick={() => openEditModal(org)}>
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
											onClick={() => setDeleteConfirm(org)}
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
				<adc-modal
					ref={editModalRef}
					open
					modalTitle={editingOrg ? t("organizations.editOrganization") : t("organizations.addOrganization")}
					size="md"
				>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("organizations.slug")}</label>
							<adc-input
								value={formSlug}
								placeholder={t("organizations.slugPlaceholder")}
								onInput={(e: any) => setFormSlug(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("organizations.region")}</label>
							<select
								value={formRegion}
								onChange={(e) => setFormRegion(e.target.value)}
								className="w-full rounded-lg border border-border bg-surface text-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
							>
								{allRegions.map((r) => (
									<option key={r.path} value={r.path}>
										{r.path}
										{r.isGlobal ? ` (${t("regions.global")})` : ""}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("organizations.tier")}</label>
							<adc-input
								value={formTier}
								placeholder={t("organizations.tierPlaceholder")}
								onInput={(e: any) => setFormTier(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1 text-text">{t("organizations.status")}</label>
							<select
								value={formStatus}
								onChange={(e) => setFormStatus(e.target.value)}
								className="w-full rounded-lg border border-border bg-surface text-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
							>
								{ORG_STATUSES.map((s) => (
									<option key={s} value={s}>
										{t(`organizations.statuses.${s}`)}
									</option>
								))}
							</select>
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
				<adc-modal ref={membersModalRef} open modalTitle={t("organizations.manageMembers", { slug: membersModal.slug })} size="md">
					<div className="space-y-4">
						{/* User search */}
						<div className="relative">
							<adc-search-input ref={userSearchRef} placeholder={t("organizations.searchUserPlaceholder")} debounce={350} />
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
							<p className="text-sm text-muted py-2">{t("organizations.noMembers")}</p>
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
					<p className="text-text">{t("organizations.deleteConfirm", { slug: deleteConfirm.slug })}</p>
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
