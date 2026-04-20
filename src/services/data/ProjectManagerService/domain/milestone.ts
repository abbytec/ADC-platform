import { Schema } from "mongoose";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";

export const milestoneSchema = new Schema<Milestone>(
	{
		id: { type: String, required: true, unique: true },
		projectId: { type: String, required: true, index: true },
		name: { type: String, required: true },
		description: String,
		startDate: Date,
		endDate: Date,
		status: { type: String, enum: ["planned", "active", "completed", "cancelled"], default: "planned" },
		createdAt: { type: Date, default: Date.now },
	},
	{ id: false }
);
