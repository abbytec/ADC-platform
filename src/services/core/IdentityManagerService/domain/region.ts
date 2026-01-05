import { Schema } from "mongoose";
/**
 * Metadata de región (extensible)
 */
export interface RegionMetadata {
	objectConnectionUri?: string;
	cacheConnectionUri?: string;
	[key: string]: any;
}

/**
 * Información de región
 */
export interface RegionInfo {
	path: string;
	isGlobal: boolean;
	isActive: boolean;
	metadata: RegionMetadata;
	createdAt: Date;
	updatedAt: Date;
}

export const regionSchema = new Schema<RegionInfo>({
	path: { type: String, required: true, unique: true },
	isGlobal: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },
	metadata: {
		objectConnectionUri: String,
		cacheConnectionUri: String,
	},
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});
