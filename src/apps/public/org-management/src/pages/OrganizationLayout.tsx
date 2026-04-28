import "@ui-library/utils/react-jsx";
import { useState, useCallback, useEffect, useRef } from "react";
import { router } from "@common/utils/router.js";
import GeneralTab from "../components/tabs/GeneralTab";
import AppsTab from "../components/tabs/AppsTab";
import AdminTab from "../components/tabs/AdminTab";

interface OrganizationLayoutProps {
	slug: string;
	initialTab: "general" | "apps" | "admin";
}

type SettingsTab = "general" | "apps" | "admin";

const TABS = {
	general: {
		label: "General",
		icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
	},
	apps: {
		label: "Aplicaciones",
		icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>`,
	},
	admin: {
		label: "Administración",
		icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
	},
} as const;

export default function OrganizationLayout({ slug, initialTab }: OrganizationLayoutProps) {
	const sidebarRef = useRef<HTMLElement>(null);
	const buttonRef = useRef<HTMLElement>(null);
	const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || "general");
	const [sidebarExpanded, setSidebarExpanded] = useState(false);

	// Handle sidebar navigation
	const handleSidebarItemClick = useCallback((e: Event) => {
		const action = (e as CustomEvent).detail?.action;
		if (!action) return;

		setActiveTab(action as SettingsTab);
		router.navigate(`/organization/${slug}/${action === "general" ? "" : action}`);
		setSidebarExpanded(false);
	}, [slug]);

	const handleExpandToggle = useCallback((e: Event) => {
		setSidebarExpanded(!!(e as CustomEvent).detail);
	}, []);

	// Setup listeners
	useEffect(() => {
		const sidebar = sidebarRef.current;
		const button = buttonRef.current;

		if (!sidebar || !button) return;

		sidebar.addEventListener("adcSidebarItemClick", handleSidebarItemClick);
		button.addEventListener("adcExpandToggle", handleExpandToggle);

		return () => {
			sidebar.removeEventListener("adcSidebarItemClick", handleSidebarItemClick);
			button.removeEventListener("adcExpandToggle", handleExpandToggle);
		};
	}, [handleSidebarItemClick, handleExpandToggle]);

	// Render active tab component
	const renderTabContent = () => {
		switch (activeTab) {
			case "general":
				return <GeneralTab slug={slug} />;
			case "apps":
				return <AppsTab slug={slug} />;
			case "admin":
				return <AdminTab slug={slug} />;
			default:
				return <GeneralTab slug={slug} />;
		}
	};

	return (
		<div className="flex min-h-screen bg-background">
			{/* Expand button */}
			<div
				className={`
					fixed top-1/2 z-50 lg:hidden
					-translate-y-1/2 transition-all duration-300
					${sidebarExpanded ? "left-70" : "left-22"}
				`}
			>
				<adc-button-expand ref={buttonRef} isExpanded={sidebarExpanded} />
			</div>

			{/* Sidebar */}
			<adc-sidebar
				ref={sidebarRef}
				items={Object.entries(TABS).map(([key, value]) => ({
					label: value.label,
					iconSvg: value.icon,
					action: key,
				}))}
				collapsed={!sidebarExpanded}
				activeItem={activeTab}
				title={`${slug.toUpperCase()}`}
				subtitle="Gestiona tu organización"
			/>

			{/* Main Content */}
			<main
				className={`
					flex-1 transition-all duration-300
					${sidebarExpanded ? "lg:ml-74" : "lg:mx-20"}
				`}
			>
				<div className="w-full flex flex-col pt-10 pl-25 lg:pl-70">
					<div className="animate-fade-in">{renderTabContent()}</div>
				</div>
			</main>
		</div>
	);
}
