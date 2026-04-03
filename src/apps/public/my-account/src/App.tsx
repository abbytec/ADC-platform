import React, { useState, useRef, useEffect } from "react";
import "@ui-library/utils/react-jsx";

import ProfileView from "./pages/ProfileView";
import NotificationsView from "./pages/NotificationView";
import PrivacySecurityView from "./pages/PrivacySecurityView";
import AppearanceView from "./pages/AppearanceView";
import AdminView from "./pages/AdminView";

const ICONS = {
	profile: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>`,
	notifications: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM15 7v5H9v6H5V7h10z"/></svg>`,
	privacy: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>`,
	security: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
	appearance: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232a2.5 2.5 0 013.536 3.536l-8.486 8.486a4.5 4.5 0 01-2.121 1.171L5 20l.575-3.06a4.5 4.5 0 011.171-2.121l8.486-8.486zm1.768-1.768a4 4 0 00-5.657 0l-1.179 1.179 5.657 5.657 1.179-1.179a4 4 0 000-5.657z"/></svg>`,
	admin: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
};

type SettingsSection = "profile" | "notifications" | "privacy-security" | "appearance" | "admin";

export default function App() {
	const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
	const [sidebarExpanded, setSidebarExpanded] = useState(false);
	const sidebarRef = useRef<HTMLElement>(null);
	const buttonRef = useRef<HTMLElement>(null);

	const handleSidebarItemClick = (e: CustomEvent) => {
		const action = e.detail?.action;
		if (action) {
			setActiveSection(action as SettingsSection);
			// Cerrar sidebar en móvil después de seleccionar
			setSidebarExpanded(false);
		}
	};

	const handleExpandToggle = (e: CustomEvent) => {
		setSidebarExpanded(e.detail);
	};

	useEffect(() => {
		const sidebar = sidebarRef.current;
		if (sidebar) {
			sidebar.addEventListener("adcSidebarItemClick", handleSidebarItemClick as EventListener);
		}
		const button = buttonRef.current;
		if (button) {
			button.addEventListener("adcExpandToggle", handleExpandToggle as EventListener);
		}
		return () => {
			if (sidebar) {
				sidebar.removeEventListener("adcSidebarItemClick", handleSidebarItemClick as EventListener);
			}
			if (button) {
				button.removeEventListener("adcExpandToggle", handleExpandToggle as EventListener);
			}
		};
	}, []);

	const renderSection = () => {
		switch (activeSection) {
			case "profile":
				return <ProfileView />;
			case "notifications":
				return <NotificationsView />;
			case "privacy-security":
				return <PrivacySecurityView />;
			case "appearance":
				return <AppearanceView />;
			case "admin":
				return <AdminView />;
			default:
				return <ProfileView />;
		}
	};

	return (
		<div className="flex h-min-screen bg-background">
			{/* Expand button flotante (solo móvil) */}
			<div
				className={`fixed top-1/2 z-50 lg:hidden transform -translate-y-1/2 transition-all duration-300 ${sidebarExpanded ? "left-68" : "left-20"}`}
			>
				<adc-button-expand
					ref={buttonRef}
					isExpanded={sidebarExpanded}
					aria-label="Expandir menú de navegación"
					aria-controls="sidebar-menu"
				/>
			</div>

			{/* Sidebar */}
			<adc-sidebar
				ref={sidebarRef}
				items={[
					{ label: "Perfil", iconSvg: ICONS.profile, action: "profile" },
					{ label: "Notificaciones", iconSvg: ICONS.notifications, action: "notifications" },
					{ label: "Privacidad y Seguridad", iconSvg: ICONS.security, action: "privacy-security" },
					{ label: "Apariencia", iconSvg: ICONS.appearance, action: "appearance" },
					{ label: "Administración", iconSvg: ICONS.admin, action: "admin" },
				]}
				collapsed={!sidebarExpanded}
				activeItem={activeSection}
			/>

			{/* Main Content */}
			<main className={`ml-15 lg:ml-64 ${sidebarExpanded ? "ml-0" : ""}`}>
				<div className="max-w-4xl mx-auto p-adc-lg">
					<div className="animate-fade-in">{renderSection()}</div>
				</div>
			</main>
		</div>
	);
}
