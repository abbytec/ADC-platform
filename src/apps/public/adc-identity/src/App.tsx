import "@ui-library/utils/react-jsx";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { router } from "@common/utils/router";
import { identityApi, type IdentityScope } from "./utils/identity-api.ts";
import { getVisibleTabs, type IdentityTab } from "./utils/permissions.ts";
import { UsersView } from "./pages/UsersView.tsx";
import { RolesView } from "./pages/RolesView.tsx";
import { GroupsView } from "./pages/GroupsView.tsx";
import { OrganizationsView } from "./pages/OrganizationsView.tsx";
import { RegionsView } from "./pages/RegionsView.tsx";
import { clearErrors } from "@ui-library/utils/adc-fetch";

/** Extracts tab id from a URL path like "/roles" → "roles", "/" → "" */
function getTabFromPath(path: string): string {
	return path.replace(/^\/+/, "").split("/")[0] || "";
}

export default function App() {
	const { t, ready } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [scopes, setScopes] = useState<IdentityScope[]>([]);
	const [visibleTabs, setVisibleTabs] = useState<IdentityTab[]>([]);
	const [activeTab, setActiveTab] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [unauthorized, setUnauthorized] = useState(false);

	const loadPermissions = useCallback(async () => {
		setLoading(true);
		clearErrors();

		const result = await identityApi.getMyPermissions();

		if (result.success && result.data) {
			const userScopes = result.data.scopes;
			setScopes(userScopes);

			const tabs = getVisibleTabs(userScopes);
			setVisibleTabs(tabs);

			if (tabs.length > 0) {
				// Resolve initial tab from URL path, fallback to first tab
				const pathTab = getTabFromPath(router.getCurrentPath());
				const matchedTab = tabs.find((tab) => tab.id === pathTab);
				const initialTab = matchedTab ? matchedTab.id : tabs[0].id;
				setActiveTab(initialTab);

				// Sync URL if it doesn't match the resolved tab
				if (!matchedTab) {
					router.navigate("/" + initialTab);
				}
			} else {
				setUnauthorized(true);
			}
		} else {
			setUnauthorized(true);
		}

		setLoading(false);
	}, []);

	useEffect(() => {
		loadPermissions();
	}, [loadPermissions]);

	const handleTabChange = useCallback((tabId: string) => {
		setActiveTab(tabId);
		clearErrors();
		router.navigate("/" + tabId);
	}, []);

	// Sync tabs with browser back/forward navigation
	useEffect(() => {
		return router.setOnRouteChange((path) => {
			const tabId = getTabFromPath(path);
			if (tabId && visibleTabs.some((tab) => tab.id === tabId)) {
				setActiveTab(tabId);
				clearErrors();
			}
		});
	}, [visibleTabs]);

	const tabsRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const el = tabsRef.current;
		if (!el) return;
		const handler = (e: Event) => handleTabChange((e as CustomEvent<string>).detail);
		el.addEventListener("adcTabChange", handler);
		return () => el.removeEventListener("adcTabChange", handler);
	});

	// Loading skeleton
	if (!ready || loading) {
		return (
			<div className="max-w-6xl mx-auto px-4 py-8">
				<adc-skeleton variant="rectangular" height="48px" class="mb-6" />
				<adc-skeleton variant="rectangular" height="400px" />
			</div>
		);
	}

	// Unauthorized
	if (unauthorized || visibleTabs.length === 0) {
		return (
			<div className="max-w-6xl mx-auto px-4 py-16 text-center">
				<h1 className="font-heading text-2xl font-bold text-text mb-4">{t("common.unauthorized")}</h1>
				<p className="text-muted">{t("common.noPermissions")}</p>
			</div>
		);
	}

	const tabItems = visibleTabs.map((tab) => ({
		id: tab.id,
		label: t(`tabs.${tab.label}`),
	}));

	const renderActiveView = () => {
		switch (activeTab) {
			case "users":
				return <UsersView scopes={scopes} />;
			case "roles":
				return <RolesView scopes={scopes} />;
			case "groups":
				return <GroupsView scopes={scopes} />;
			case "organizations":
				return <OrganizationsView scopes={scopes} />;
			case "regions":
				return <RegionsView scopes={scopes} />;
			default:
				return null;
		}
	};

	return (
		<div className="max-w-6xl mx-auto px-4 py-8">
			<h1 className="font-heading text-2xl font-bold text-text mb-6">{t("common.title")}</h1>

			<adc-tabs ref={tabsRef} tabs={JSON.stringify(tabItems)} activeTab={activeTab} variant="underline" />

			<div className="mt-6">{renderActiveView()}</div>
		</div>
	);
}
