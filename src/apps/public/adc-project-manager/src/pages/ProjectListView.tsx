import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import { pmApi } from "../utils/pm-api.ts";
import { canWrite, Scope } from "../utils/permissions.ts";
import { ProjectCard } from "../components/projects/ProjectCard.tsx";
import { CreateProjectModal, type ProjectFormState } from "../components/projects/CreateProjectModal.tsx";

interface Props {
	scopes: Permission[];
	orgId?: string;
	/** Slug de la organización propia (o "default" en contexto global). Se usa para el check de slug. */
	orgSlug: string;
	onOpen: (project: Project) => void;
}

export function ProjectListView({ scopes, orgId, orgSlug, onOpen }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		const res = await pmApi.listProjects();
		if (res.success && res.data) setProjects(res.data.projects);
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const handleCreate = async (form: ProjectFormState) => {
		const res = await pmApi.createProject({
			name: form.name,
			slug: form.slug,
			description: form.description,
			visibility: form.visibility,
			orgId: orgId ?? null,
		});
		if (res.success) {
			setShowCreate(false);
			await load();
		}
	};

	const handleDelete = async (id: string) => {
		if (!globalThis.confirm(t("common.confirmDelete"))) return;
		const res = await pmApi.deleteProject(id);
		if (res.success) await load();
	};

	if (loading) return <adc-skeleton variant="rectangular" height="300px" />;

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h2 className="font-heading text-xl font-semibold text-text">{t("projects.title")}</h2>
				{canWrite(scopes, Scope.PROJECTS) && (
					<adc-button variant="primary" onClick={() => setShowCreate(true)}>
						{t("projects.newProject")}
					</adc-button>
				)}
			</div>

			{projects.length === 0 ? (
				<p className="text-muted text-center py-8">{t("projects.empty")}</p>
			) : (
				<div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
					{projects.map((p) => (
						<ProjectCard key={p.id} project={p} scopes={scopes} onOpen={onOpen} onDelete={handleDelete} />
					))}
				</div>
			)}

			{showCreate && <CreateProjectModal orgSlug={orgSlug} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
		</div>
	);
}
