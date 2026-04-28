import "@ui-library/utils/react-jsx";
import { useState, useEffect } from "react";
import { router } from "@common/utils/router.js";
import { mockOrganizationRequests } from "./data/mockData.js";
import CreateOrgPage from "./pages/CreateOrgPage";
import OrganizationLayout from "./pages/OrganizationLayout";

/**
 * Routing:
 *   /org-management           → Create organization form
 *   /organization/:slug       → Organization layout (default: general tab)
 *   /organization/:slug/*     → Organization tabs (apps, admin)
 */

function parseRoute(path: string) {
	if (path === "/org-management" || path === "/") {
		return { type: "create" as const };
	}

	const orgMatch = /^\/organization\/([^/]+)(?:\/(\w+))?/.exec(path);
	if (orgMatch) {
		const slug = orgMatch[1];
		const tab = (orgMatch[2] || "general") as "general" | "apps" | "admin";
		return { type: "organization" as const, slug, tab };
	}

	return { type: "create" as const };
}

export default function App() {
	const [currentPath, setCurrentPath] = useState(router.getCurrentPath() || "/org-management");
	const [organizationExists, setOrganizationExists] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		return router.setOnRouteChange(setCurrentPath);
	}, []);

	const route = parseRoute(currentPath);

	// Check if organization exists and is approved
	useEffect(() => {
		if (route.type === "organization") {
			const org = mockOrganizationRequests.find(
				(req) => req.slug === route.slug && req.status === "approved"
			);
			setOrganizationExists(!!org);
		}
		setLoading(false);
	}, [route]);

	if (loading) {
		return (
			<adc-layout>
				<main className="animate-fade-in min-h-screen flex items-center justify-center">
					<adc-skeleton variant="circular" width="40px" height="40px" />
				</main>
			</adc-layout>
		);
	}

	// Organization not found or not approved
	if (route.type === "organization" && !organizationExists) {
		return (
			<adc-layout>
				<main className="animate-fade-in">
					<div className="min-h-screen bg-background px-4 py-12 flex items-center">
						<div className="max-w-md mx-auto text-center">
							<div className="text-6xl mb-4">🔒</div>
							<h1 className="text-3xl font-bold text-text mb-3">Organización no encontrada</h1>
							<p className="text-muted mb-6">
								La organización que buscas no existe o aún no ha sido aprobada por el equipo administrativo.
							</p>
							<div className="flex gap-3">
								<adc-button
									type="button"
						
									onClick={() => router.navigate("/org-management")}
									class="flex-1"
								>
									Volver
								</adc-button>
								<adc-button
									type="button"
									onClick={() => router.navigate("/")}
									class="flex-1"
								>
									Inicio
								</adc-button>
							</div>
						</div>
					</div>
				</main>
			</adc-layout>
		);
	}

	return (
		<adc-layout>
			<main className="animate-fade-in">
				{route.type === "create" ? (
					<CreateOrgPage />
				) : (
					<OrganizationLayout slug={route.slug} initialTab={route.tab} />
				)}
			</main>
		</adc-layout>
	);
}
