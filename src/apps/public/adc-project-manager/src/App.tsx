import "@ui-library/utils/react-jsx";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { router } from "@common/utils/router";
import { pmApi } from "./utils/pm-api.ts";
import { identityPmApi } from "./utils/identity-api.ts";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import { canAccessProjects } from "./utils/permissions.ts";
import { ProjectListView } from "./pages/ProjectListView.tsx";
import { ProjectDetailView } from "./pages/ProjectDetailView.tsx";
import { LandingView } from "./pages/LandingView.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";
import { getSession } from "@ui-library/utils/session";

/**
 * Routing:
 *   /                                      → Project list
 *   /:orgSlug/:projectSlug                 → Project detail (default: issues tab)
 *   /:orgSlug/:projectSlug/:tab            → Issues | Sprints | Milestones
 *   orgSlug === "default" ⇒ proyecto global
 */
const VALID_TABS = new Set(["board", "issues", "calendar", "sprints", "milestones", "settings"]);

function parseRoute(path: string): { orgSlug?: string; projectSlug?: string; tab?: string } {
	const parts = path.replace(/^\/+/, "").split("/").filter(Boolean);
	if (parts.length >= 2) {
		const tab = parts[2] && VALID_TABS.has(parts[2]) ? parts[2] : "board";
		return { orgSlug: parts[0], projectSlug: parts[1], tab };
	}
	return {};
}

export default function App() {
	const { t, ready } = useTranslation({ namespace: "adc-project-manager", autoLoad: true });
	const [perms, setPerms] = useState<Permission[]>([]);
	const [caller, setCaller] = useState<{ userId: string; groupIds: string[] } | undefined>(undefined);
	const [loading, setLoading] = useState(true);
	const [unauthorized, setUnauthorized] = useState(false);
	const [orgId, setOrgId] = useState<string | undefined>(undefined);
	const [isAdmin, setIsAdmin] = useState(false);
	const [isOrgAdmin, setIsOrgAdmin] = useState(false);
	const [ownOrgSlug, setOwnOrgSlug] = useState<string>("default");
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);
	const [selectedOrgSlug, setSelectedOrgSlug] = useState<string>("default");
	const [activeTab, setActiveTab] = useState("issues");

	// Cache de orgId → orgSlug para no repetir lookups.
	const orgSlugCache = useRef<Map<string, string>>(new Map());

	const resolveOrgSlug = useCallback(async (projectOrgId: string | null | undefined): Promise<string> => {
		if (!projectOrgId) return "default";
		const cached = orgSlugCache.current.get(projectOrgId);
		if (cached) return cached;
		const res = await identityPmApi.getOrganizationSlug(projectOrgId);
		const slug = res.success && res.data?.slug ? res.data.slug : projectOrgId;
		orgSlugCache.current.set(projectOrgId, slug);
		return slug;
	}, []);

	const loadPermissions = useCallback(async () => {
		setLoading(true);
		clearErrors();
		const session = await getSession(true);
		if (session.authenticated && session.user) {
			const userPerms = session.user.perms ?? [];
			const userId = session.user.id;
			const groupIds = session.user.groupIds ?? [];
			setPerms(userPerms);
			setOrgId(session.user.orgId || undefined);
			setIsAdmin(!!session.user.isAdmin);
			setIsOrgAdmin(!!session.user.isOrgAdmin);
			setCaller({ userId, groupIds });

			// El acceso al app no requiere permiso formal PM.READ: un usuario que
			// sea miembro de al menos un proyecto también debe poder entrar.
			// Si no tiene permiso formal, consultamos la lista de proyectos visibles.
			let allowed = canAccessProjects(userPerms);
			if (!allowed) {
				const listRes = await pmApi.listProjects();
				allowed = !!(listRes.success && listRes.data?.projects?.length);
			}
			// Cualquier usuario autenticado puede crear un proyecto privado, así
			// que admitimos el acceso aunque todavía no tenga proyectos.
			if (!allowed && userId) allowed = true;
			if (!allowed) {
				setUnauthorized(true);
				setLoading(false);
				return;
			}

			// Resolver slug de la org propia (o "default" para contexto global)
			const ownSlug = await resolveOrgSlug(session.user.orgId);
			setOwnOrgSlug(ownSlug);
			// Restore from URL
			const route = parseRoute(router.getCurrentPath());
			if (route.orgSlug && route.projectSlug) {
				const res = await pmApi.getProjectBySlug(route.orgSlug, route.projectSlug);
				if (res.success && res.data) {
					setSelectedProject(res.data);
					setSelectedOrgSlug(route.orgSlug);
					setActiveTab(route.tab || "board");
				} else {
					setSelectedProject(null);
					router.navigate("/");
				}
			}
		} else {
			setUnauthorized(true);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		loadPermissions();
	}, [loadPermissions]);

	useEffect(() => {
		return router.setOnRouteChange(() => {
			clearErrors();
			loadPermissions();
		});
	}, []);

	const openProject = useCallback(
		async (project: Project) => {
			const orgSlug = await resolveOrgSlug(project.orgId);
			setSelectedProject(project);
			setSelectedOrgSlug(orgSlug);
			setActiveTab("board");
			router.navigate(`/${orgSlug}/${project.slug}`);
		},
		[resolveOrgSlug]
	);

	const backToProjects = useCallback(() => {
		setSelectedProject(null);
		clearErrors();
		router.navigate("/");
	}, []);

	if (!ready || loading) {
		return (
			<div className="mx-auto px-4 py-8">
				<adc-skeleton variant="rectangular" height="48px" class="mb-6" />
				<adc-skeleton variant="rectangular" height="400px" />
			</div>
		);
	}

	if (unauthorized) {
		return <LandingView />;
	}

	return (
		<div className="mx-auto px-4 py-8">
			{selectedProject ? (
				<ProjectDetailView
					project={selectedProject}
					orgSlug={selectedOrgSlug}
					perms={perms}
					caller={caller}
					activeTab={activeTab}
					onBack={backToProjects}
				/>
			) : (
				<>
					<h1 className="font-heading text-2xl font-bold text-text mb-6">{t("common.title")}</h1>
					<ProjectListView
						perms={perms}
						caller={caller}
						isAdmin={isAdmin}
						isOrgAdmin={isOrgAdmin}
						orgId={orgId}
						orgSlug={ownOrgSlug}
						onOpen={openProject}
					/>
				</>
			)}
		</div>
	);
}
