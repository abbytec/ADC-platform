/**
 * Type definitions for org-management microfrontend
 */

export interface SocialNetwork {
	platform: string;
	url: string;
	icon?: string;
}

export interface Organization {
	id: string;
	slug: string;
	name: string;
	description: string;
	url: string;
	email?: string;
	logo?: string;
	socialNetworks?: SocialNetwork[];
	createdAt: string;
	owner: {
		id: string;
		name: string;
		email: string;
	};
}

export interface App {
	id: string;
	name: string;
	enabled: boolean;
	description?: string;
	icon?: string;
}

export interface Ticket {
	id: string;
	title: string;
	description: string;
	status: "pending" | "approved" | "rejected";
	createdAt: string;
	createdBy: {
		id: string;
		name: string;
	};
	updatedAt: string;
}

export interface OrganizationRequest {
	id: string;
	orgName: string;
	email: string;
	description?: string;
	url?: string;
	socialNetworks?: SocialNetwork[];
	status: "pending" | "approved" | "rejected";
	createdAt: string;
	createdBy: {
		id: string;
		email: string;
	};
	approvedBy?: {
		id: string;
		name: string;
	};
	approvedAt?: string;
	rejectionReason?: string;
	slug?: string; // Generated when approved
}

export type SettingsTab = "general" | "apps" | "admin";
