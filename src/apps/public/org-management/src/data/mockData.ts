import type { Organization, App, Ticket, OrganizationRequest } from "../types";

// Mock organization data
export const mockOrganization: Organization = {
	id: "org-001",
	slug: "acme-corp",
	name: "ACME Corporation",
	description: "Leading innovator in digital solutions and cloud technologies",
	url: "https://acme-corp.example.com",
	email: "contacto@acme-corp.com",
	logo: "https://via.placeholder.com/200x200?text=ACME",
	socialNetworks: [
		{
			platform: "twitter",
			url: "https://twitter.com/acmecorp",
			icon: "𝕏",
		},
		{
			platform: "linkedin",
			url: "https://linkedin.com/company/acme-corporation",
			icon: "💼",
		},
		{
			platform: "github",
			url: "https://github.com/acmecorp",
			icon: "🐙",
		},
	],
	createdAt: "2023-01-15T10:30:00Z",
	owner: {
		id: "user-001",
		name: "John Doe",
		email: "john@acme-corp.com",
	},
};

// Mock apps data
export const mockApps: App[] = [
	{
		id: "app-001",
		name: "Ecommerce",
		enabled: true,
		description: "Online store and sales platform",
		icon: "🛒",
	},
	{
		id: "app-002",
		name: "Blog",
		enabled: false,
		description: "Content management and publishing system",
		icon: "📝",
	},
	{
		id: "app-003",
		name: "Analytics",
		enabled: true,
		description: "Data insights and performance tracking",
		icon: "📊",
	},
	{
		id: "app-004",
		name: "CRM",
		enabled: false,
		description: "Customer relationship management system",
		icon: "👥",
	},
	{
		id: "app-005",
		name: "Email Marketing",
		enabled: true,
		description: "Campaign automation and email management",
		icon: "📧",
	},
];

// Mock tickets data
export const mockTickets: Ticket[] = [
	{
		id: "ticket-001",
		title: "Add SAML Integration",
		description: "Implement SAML single sign-on authentication for enterprise users",
		status: "pending",
		createdAt: "2024-04-20T14:30:00Z",
		createdBy: {
			id: "user-002",
			name: "Jane Smith",
		},
		updatedAt: "2024-04-20T14:30:00Z",
	},
	{
		id: "ticket-002",
		title: "API Rate Limiting",
		description: "Implement rate limiting on REST API endpoints",
		status: "approved",
		createdAt: "2024-04-15T09:15:00Z",
		createdBy: {
			id: "user-003",
			name: "Mike Johnson",
		},
		updatedAt: "2024-04-18T16:45:00Z",
	},
	{
		id: "ticket-003",
		title: "Custom Domain Support",
		description: "Allow organizations to use custom domains for their applications",
		status: "rejected",
		createdAt: "2024-04-10T11:00:00Z",
		createdBy: {
			id: "user-004",
			name: "Sarah Williams",
		},
		updatedAt: "2024-04-12T13:20:00Z",
	},
	{
		id: "ticket-004",
		title: "Webhook System",
		description: "Implement webhook support for real-time event notifications",
		status: "pending",
		createdAt: "2024-04-22T08:45:00Z",
		createdBy: {
			id: "user-005",
			name: "David Brown",
		},
		updatedAt: "2024-04-22T08:45:00Z",
	},
	{
		id: "ticket-005",
		title: "Backup and Restore",
		description: "Add automated backup and disaster recovery features",
		status: "approved",
		createdAt: "2024-04-08T15:30:00Z",
		createdBy: {
			id: "user-006",
			name: "Emma Davis",
		},
		updatedAt: "2024-04-19T10:15:00Z",
	},
];

// Mock list of organizations for dropdown/selection (if needed)
export const mockOrganizations: Organization[] = [
	mockOrganization,
	{
		id: "org-002",
		slug: "techstart-inc",
		name: "TechStart Inc.",
		description: "Innovative startup focused on AI solutions",
		url: "https://techstart.example.com",
		email: "info@techstart.com",
		logo: "https://via.placeholder.com/200x200?text=TechStart",
		socialNetworks: [
			{
				platform: "linkedin",
				url: "https://linkedin.com/company/techstart-inc",
				icon: "💼",
			},
			{
				platform: "twitter",
				url: "https://twitter.com/techstart",
				icon: "𝕏",
			},
		],
		createdAt: "2023-06-20T12:00:00Z",
		owner: {
			id: "user-007",
			name: "Lisa Chen",
			email: "lisa@techstart.com",
		},
	},
];

// Mock organization requests (pending approval)
export const mockOrganizationRequests: OrganizationRequest[] = [
	{
		id: "req-001",
		orgName: "Global Tech Solutions",
		email: "admin@globaltech.com",
		description: "Enterprise software development and consulting services",
		url: "https://globaltech.example.com",
		status: "pending",
		createdAt: "2024-04-25T10:15:00Z",
		createdBy: {
			id: "user-008",
			email: "admin@globaltech.com",
		},
	},
	{
		id: "req-002",
		orgName: "Creative Studios",
		email: "contact@creativestudios.com",
		description: "Digital design and content creation agency",
		url: "https://creativestudios.example.com",
		status: "pending",
		createdAt: "2024-04-24T14:45:00Z",
		createdBy: {
			id: "user-009",
			email: "contact@creativestudios.com",
		},
	},
	{
		id: "req-003",
		orgName: "Data Analytics Pro",
		email: "info@dataanalyticspro.com",
		description: "Business intelligence and data analytics platform",
		url: "https://dataanalyticspro.example.com",
		status: "approved",
		createdAt: "2024-04-20T09:30:00Z",
		createdBy: {
			id: "user-010",
			email: "info@dataanalyticspro.com",
		},
		approvedBy: {
			id: "user-admin-001",
			name: "Admin User",
		},
		approvedAt: "2024-04-22T11:00:00Z",
		slug: "data-analytics-pro",
	},
];
