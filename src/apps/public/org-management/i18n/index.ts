/**
 * i18n configuration for org-management
 */

import type { i18nResource } from "@ui-library/utils/i18n";

export const resources = {
	es: {
		"org-management": {
			common: {
				title: "Gestión de Organizaciones",
				description: "Administra tu organización en ADC Platform",
			},
			navigation: {
				general: "General",
				apps: "Aplicaciones",
				admin: "Administración",
			},
			pages: {
				create: {
					title: "Crear Nueva Organización",
					description:
						"Configura tu organización y comienza a colaborar con tu equipo",
				},
			},
		},
	},
	en: {
		"org-management": {
			common: {
				title: "Organization Management",
				description: "Manage your organization in ADC Platform",
			},
			navigation: {
				general: "General",
				apps: "Applications",
				admin: "Administration",
			},
			pages: {
				create: {
					title: "Create New Organization",
					description:
						"Set up your organization and start collaborating with your team",
				},
			},
		},
	},
} as const;
