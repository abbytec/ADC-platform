import { Schema } from "mongoose";
import type { Permission } from "./permission.ts";
/**
 * Grupo de usuarios
 */
export interface Group {
	id: string;
	name: string;
	description: string;
	roleIds: string[];
	permissions?: Permission[];
	/** Organización a la que pertenece (null = global) */
	orgId?: string;
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

export const groupSchema = new Schema<Group>(
	{
		id: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		description: String,
		roleIds: [String],
		permissions: [
			{
				resource: { type: String, required: true },
				action: { type: Number, required: true }, // Bitfield
				scope: { type: Number, required: true }, // Bitfield
			},
		],
		orgId: { type: String, default: null },
		metadata: Schema.Types.Mixed,
		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
	},
	{ id: false }
);
