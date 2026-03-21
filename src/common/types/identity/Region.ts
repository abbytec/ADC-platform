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
