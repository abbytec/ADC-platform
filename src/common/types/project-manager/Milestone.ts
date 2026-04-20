export type MilestoneStatus = "planned" | "active" | "completed" | "cancelled";

export interface Milestone {
	id: string;
	projectId: string;
	name: string;
	description?: string;
	startDate?: Date;
	endDate?: Date;
	status: MilestoneStatus;
	createdAt: Date;
}
