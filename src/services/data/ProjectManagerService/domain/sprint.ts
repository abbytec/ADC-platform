import { Schema } from "mongoose";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";

export const sprintSchema = new Schema<Sprint>(
	{
		id: { type: String, required: true, unique: true },
		projectId: { type: String, required: true, index: true },
		name: { type: String, required: true },
		goal: String,
		startDate: Date,
		endDate: Date,
		status: { type: String, enum: ["planned", "active", "completed"], default: "planned" },
		createdAt: { type: Date, default: Date.now },
		completedAt: Date,
	},
	{ id: false }
);
