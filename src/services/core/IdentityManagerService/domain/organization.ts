import { Schema } from "mongoose";
import type { Permission } from "./permission.ts";
/**
 * Organización
 */
export interface Organization {
	orgId: string;
	slug: string;
	region: string;
	tier: "default";
	status: "active" | "inactive" | "blocked";
	permissions?: Permission[];
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

export const organizationSchema = new Schema<Organization>({
	orgId: { type: String, required: true, unique: true },
	slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
	region: { type: String, required: true, default: "default/default" },
	tier: { type: String, enum: ["default"], default: "default" },
	status: { type: String, enum: ["active", "inactive", "blocked"], default: "active" },
	permissions: [
		{
			resource: { type: String, required: true },
			action: { type: Number, required: true }, // Bitfield
			scope: { type: Number, required: true }, // Bitfield
		},
	],
	metadata: Schema.Types.Mixed,
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});
