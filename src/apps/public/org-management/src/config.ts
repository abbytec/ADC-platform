/**
 * Application configuration and constants
 */

export const APP_CONFIG = {
	name: "org-management",
	version: "1.0.0",
	namespace: "adc-platform",
	devPort: 3017,
};

export const ROUTES = {
	CREATE_ORG: "/org-management",
	ORG_BASE: (slug: string) => `/organization/${slug}`,
	ORG_GENERAL: (slug: string) => `/organization/${slug}`,
	ORG_APPS: (slug: string) => `/organization/${slug}/apps`,
	ORG_ADMIN: (slug: string) => `/organization/${slug}/admin`,
};

export const VALIDATION = {
	ORG_NAME_MIN: 3,
	ORG_NAME_MAX: 100,
	DESCRIPTION_MAX: 500,
	URL_PATTERN: /^https?:\/\/.+\..+/,
};

export const ANIMATIONS = {
	DURATION_FAST: 150,
	DURATION_BASE: 300,
	DURATION_SLOW: 500,
};
