export type SprintStatus = "planned" | "active" | "completed";

export interface Sprint {
	id: string;
	projectId: string;
	name: string;
	goal?: string;
	startDate?: Date;
	endDate?: Date;
	status: SprintStatus;
	createdAt: Date;
	completedAt?: Date;
}
