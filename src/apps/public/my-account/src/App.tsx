import React, { useState, useRef, useEffect } from "react";
import "@ui-library/utils/react-jsx";

import ProfileView from "./pages/ProfileView";
import NotificationsView from "./pages/NotificationView";
import PrivacyView from "./pages/PrivacyView";
import SecurityView from "./pages/SecurityView";

type SettingsSection = "profile" | "notifications" | "privacy" | "security" | "appearance" | "admin";

export default function App() {
	const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
	const [sidebarExpanded, setSidebarExpanded] = useState(false);
	const sidebarRef = useRef<HTMLElement>(null);
	const buttonRef = useRef<HTMLElement>(null); // Agregar ref para el botón

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
		const button = buttonRef.current; // Agregar listener para el botón
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
			case "privacy":
				return <PrivacyView />;
			case "security":
				return <SecurityView />;
			default:
				return <ProfileView />;
		}
	};

	return (
		<div className="flex h-min-screen bg-base-100">
			{/* Expand button flotante (solo móvil) */}
			<div className="fixed top-1/2 left-0 z-50 lg:hidden transform -translate-y-1/2">
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
					{ label: "Perfil", icon: "👤", action: "profile" },
					{ label: "Notificaciones", icon: "🔔", action: "notifications" },
					{ label: "Privacidad", icon: "🔒", action: "privacy" },
					{ label: "Seguridad", icon: "🛡️", action: "security" },
				]}
				collapsed={!sidebarExpanded}
			/>

			{/* Main Content */}
			<main className={`flex-1 transition-all duration-300 ${sidebarExpanded ? "ml-64" : "ml-20"}`}>
				<div className="max-w-4xl mx-auto p-8">
					<div className="animate-fadeIn">{renderSection()}</div>
				</div>
			</main>
		</div>
	);
}
