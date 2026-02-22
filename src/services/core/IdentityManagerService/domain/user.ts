import { Schema } from "mongoose";
import { Permission } from "./permission.ts";
/**
 * Membresía por organización
 */
export interface OrgMembership {
	orgId: string;
	roleIds: string[];
	joinedAt: Date;
}

/**
 * Usuario del sistema
 */
export interface User {
	id: string;
	username: string;
	passwordHash: string;
	email?: string;
	avatar?: string;
	roleIds: string[];
	groupIds: string[];
	permissions?: Permission[];
	orgMemberships?: OrgMembership[];
	metadata?: Record<string, any>;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	lastLogin?: Date;
}

export const userSchema = new Schema<User>(
	{
		id: { type: String, required: true, unique: true },
		username: { type: String, required: true, unique: true },
		passwordHash: { type: String, required: true },
		email: String,
		roleIds: [String],
		groupIds: [String],
		orgMemberships: [
			{
				orgId: String,
				roleIds: [String],
				joinedAt: Date,
			},
		],
		permissions: [
			{
				resource: { type: String, required: true },
				action: { type: Number, required: true }, // Bitfield
				scope: { type: Number, required: true }, // Bitfield
			},
		],
		metadata: Schema.Types.Mixed,
		isActive: { type: Boolean, default: true },
		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
		lastLogin: Date,
	},
	{ id: false }
);
