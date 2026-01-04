import { Schema, type Model } from "mongoose";
import type { RegionInfo, RegionMetadata } from "../types.js";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";

export const regionSchema = new Schema({
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

export class RegionManager {
	#regionsCache: Map<string, RegionInfo> = new Map();
	#globalRegion: RegionInfo | null = null;

	constructor(
		private readonly regionModel: Model<any>,
		private readonly logger: ILogger
	) {}

	/**
	 * Precarga todas las regiones en memoria
	 * Debe llamarse al inicio del servicio
	 */
	async initialize(): Promise<void> {
		await this.#ensureDefaultRegion();

		const regions = await this.regionModel.find({ isActive: true });
		this.#regionsCache.clear();

		for (const region of regions) {
			const info = this.#toRegionInfo(region);
			this.#regionsCache.set(region.path, info);

			if (info.isGlobal) {
				this.#globalRegion = info;
			}
		}

		this.logger.logOk(`[RegionManager] ${this.#regionsCache.size} regiones cargadas en cache`);
	}

	/**
	 * Asegura que existe la región default/default como global
	 */
	async #ensureDefaultRegion(): Promise<void> {
		const defaultPath = "default/default";
		const existing = await this.regionModel.findOne({ path: defaultPath });

		if (!existing) {
			const defaultUri = process.env.MONGODB_URI || "mongodb://localhost:27017/adc-platform";

			await this.regionModel.create({
				path: defaultPath,
				isGlobal: true,
				isActive: true,
				metadata: {
					objectConnectionUri: defaultUri,
				},
			});

			this.logger.logOk(`[RegionManager] Región global creada: ${defaultPath}`);
		}
	}

	/**
	 * Crea una nueva región
	 */
	async createRegion(path: string, metadata: RegionMetadata, isGlobal: boolean = false): Promise<RegionInfo> {
		if (!this.#validatePath(path)) {
			throw new Error(`Formato de path inválido: ${path}. Esperado "region/subregion"`);
		}

		// Solo puede haber una región global
		if (isGlobal && this.#globalRegion) {
			throw new Error(`Ya existe una región global: ${this.#globalRegion.path}`);
		}

		const region = await this.regionModel.create({
			path,
			isGlobal,
			isActive: true,
			metadata,
		});

		const info = this.#toRegionInfo(region);
		this.#regionsCache.set(path, info);

		if (isGlobal) {
			this.#globalRegion = info;
		}

		this.logger.logOk(`[RegionManager] Región creada: ${path}${isGlobal ? " (global)" : ""}`);
		return info;
	}

	/**
	 * Obtiene una región por path
	 */
	async getRegion(path: string): Promise<RegionInfo | null> {
		// Primero revisar cache
		if (this.#regionsCache.has(path)) {
			return this.#regionsCache.get(path)!;
		}

		// Fallback a base de datos
		const region = await this.regionModel.findOne({ path });
		if (region) {
			const info = this.#toRegionInfo(region);
			this.#regionsCache.set(path, info);
			return info;
		}

		return null;
	}

	/**
	 * Obtiene la región global (para escrituras)
	 */
	async getGlobalRegion(): Promise<RegionInfo> {
		if (this.#globalRegion) {
			return this.#globalRegion;
		}

		const region = await this.regionModel.findOne({ isGlobal: true });
		if (!region) {
			throw new Error("No existe una región global configurada");
		}

		this.#globalRegion = this.#toRegionInfo(region);
		return this.#globalRegion;
	}

	/**
	 * Actualiza una región
	 */
	async updateRegion(path: string, updates: Partial<RegionInfo>): Promise<RegionInfo> {
		// No permitir cambiar isGlobal si ya hay otra región global
		if (updates.isGlobal && this.#globalRegion && this.#globalRegion.path !== path) {
			throw new Error(`Ya existe una región global: ${this.#globalRegion.path}`);
		}

		const region = await this.regionModel.findOneAndUpdate(
			{ path },
			{ ...updates, updatedAt: new Date() },
			{ new: true }
		);

		if (!region) throw new Error(`Región no encontrada: ${path}`);

		const info = this.#toRegionInfo(region);
		this.#regionsCache.set(path, info);

		if (info.isGlobal) {
			this.#globalRegion = info;
		}

		return info;
	}

	/**
	 * Elimina una región
	 */
	async deleteRegion(path: string): Promise<void> {
		if (path === "default/default") {
			throw new Error("No se puede eliminar la región default");
		}

		const region = await this.regionModel.findOne({ path });
		if (region?.isGlobal) {
			throw new Error("No se puede eliminar la región global");
		}

		await this.regionModel.deleteOne({ path });
		this.#regionsCache.delete(path);

		this.logger.logDebug(`[RegionManager] Región eliminada: ${path}`);
	}

	/**
	 * Obtiene todas las regiones activas
	 */
	async getAllRegions(): Promise<RegionInfo[]> {
		return Array.from(this.#regionsCache.values());
	}

	/**
	 * Obtiene el objectConnectionUri para una región
	 * Si la región no tiene uno propio, hereda del global
	 */
	getObjectConnectionUri(path: string): string | null {
		const region = this.#regionsCache.get(path);

		// Si tiene URI propio, usarlo
		if (region?.metadata?.objectConnectionUri) {
			return region.metadata.objectConnectionUri;
		}

		// Si no, heredar del global
		if (this.#globalRegion?.metadata?.objectConnectionUri) {
			return this.#globalRegion.metadata.objectConnectionUri;
		}

		return null;
	}

	/**
	 * Valida el formato del path: "region/subregion"
	 */
	#validatePath(path: string): boolean {
		const parts = path.split("/");
		return parts.length === 2 && parts.every((p) => p.length > 0 && /^[a-z0-9-]+$/.test(p));
	}

	#toRegionInfo(doc: any): RegionInfo {
		return {
			path: doc.path,
			isGlobal: doc.isGlobal,
			isActive: doc.isActive,
			metadata: doc.metadata || {},
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}
}
