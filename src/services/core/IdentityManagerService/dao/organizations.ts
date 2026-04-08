import type { Model } from "mongoose";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "../utils/auth-verifier.ts";
import { IdentityScopes } from "@common/types/identity/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import type { RegionManager } from "./regions.js";
import type { RoleManager } from "./roles.js";
import type { GroupManager } from "./groups.js";
import type { UserManager } from "./users.js";
import type { Organization } from "@common/types/identity/Organization.ts";
import type OperationsService from "../../../core/OperationsService/index.ts";
import type { Step } from "../../../core/OperationsService/types.ts";

export class OrgManager {
	#permissionChecker: PermissionChecker;
	readonly #operations: OperationsService;

	constructor(
		private readonly orgModel: Model<any>,
		private readonly roleManager: RoleManager,
		private readonly groupManager: GroupManager,
		private readonly userManager: UserManager,
		private readonly regionManager: RegionManager,
		private readonly logger: ILogger,
		operations: OperationsService,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "OrgManager");
		this.#operations = operations;
	}

	/** Crea una nueva organización */
	async createOrganization(slug: string, region?: string, metadata?: Record<string, any>, token?: string): Promise<Organization> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScopes.ORGANIZATIONS);

		const regionPath = region || "default/default";

		// Validar que la región existe
		const regionInfo = await this.regionManager.getRegion(regionPath);
		if (!regionInfo) {
			throw new Error(`Región no existe: ${regionPath}`);
		}

		// Validar slug
		const normalizedSlug = slug.toLowerCase().trim();
		if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
			throw new Error(`Slug inválido: ${slug}. Solo letras minúsculas, números y guiones`);
		}

		try {
			const org = await this.orgModel.create({
				orgId: generateId(),
				slug: normalizedSlug,
				region: regionPath,
				tier: "default",
				status: "active",
				metadata,
			});

			this.logger.logOk(`[OrgManager] Organización creada: ${normalizedSlug} en ${regionPath}`);
			return this.#toOrganization(org);
		} catch (error: any) {
			if (error.code === 11000) {
				throw new Error(`Organización ${slug} ya existe`);
			}
			throw error;
		}
	}

	/**
	 * Obtiene una organización por ID o slug
	 */
	async getOrganization(orgIdOrSlug: string, token?: string): Promise<Organization | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ORGANIZATIONS);

		const org = await this.orgModel.findOne({
			$or: [{ orgId: orgIdOrSlug }, { slug: orgIdOrSlug.toLowerCase() }],
		});

		return org ? this.#toOrganization(org) : null;
	}

	/** Actualiza una organización */
	async updateOrganization(orgId: string, updates: Partial<Organization>, token?: string): Promise<Organization> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, IdentityScopes.ORGANIZATIONS);

		// No permitir cambiar orgId
		delete (updates as any).orgId;

		// Si se cambia la región, validar que existe
		if (updates.region) {
			const regionInfo = await this.regionManager.getRegion(updates.region);
			if (!regionInfo) throw new Error(`Región no existe: ${updates.region}`);
		}

		const org = await this.orgModel.findOneAndUpdate({ orgId }, { ...updates, updatedAt: new Date() }, { new: true });

		if (!org) throw new Error(`Organización no encontrada: ${orgId}`);

		this.logger.logDebug(`[OrgManager] Organización actualizada: ${orgId}`);
		return this.#toOrganization(org);
	}

	/** Elimina una organización y todas sus referencias (cascade a través de DAOs) */
	async deleteOrganization(orgId: string, token?: string, resumeFromStep?: number): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScopes.ORGANIZATIONS);

		const org = await this.orgModel.findOne({ orgId });
		if (!org) throw new Error(`Organización no encontrada: ${orgId}`);

		// Steps defined here in the DAO - the source of truth for cascade order
		const steps: Step[] = [
			// 0: Eliminar roles de la org (cascade → user.roleIds, orgMemberships.roleIds, group.roleIds)
			() => this.roleManager.deleteAllForOrg(orgId, token),
			// 1: Eliminar groups de la org (cascade → user.groupIds)
			() => this.groupManager.deleteAllForOrg(orgId, token),
			// 2: Limpiar orgMemberships de todos los users
			() => this.userManager.removeAllOrgMemberships(orgId, token),
			// 3: Eliminar el documento de la organización
			() => this.orgModel.deleteOne({ orgId }).then(() => {}),
		];

		const startIdx = resumeFromStep ?? 0;

		const failedStep = await this.#operations.stepper(startIdx, "delete-org", orgId, steps);
		if (failedStep !== null) {
			const err = new Error(`deleteOrganization failed at step ${failedStep}`);
			(err as any).failedStep = failedStep;
			throw err;
		}

		this.logger.logOk(`[OrgManager] Organización eliminada con cascade: ${orgId}`);
	}

	/** Obtiene todas las organizaciones */
	async getAllOrganizations(token?: string): Promise<Organization[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ORGANIZATIONS);

		const orgs = await this.orgModel.find({});
		return orgs.map((org: any) => this.#toOrganization(org));
	}

	/** Obtiene organizaciones por región */
	async getOrganizationsByRegion(region: string, token?: string): Promise<Organization[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ORGANIZATIONS);

		const orgs = await this.orgModel.find({ region });
		return orgs.map((org: any) => this.#toOrganization(org));
	}

	/**
	 * Genera el nombre de la base de datos para una organización
	 * Formato: org_{slug}
	 */
	getDbName(org: Organization): string {
		return `org_${org.slug}`;
	}

	#toOrganization(doc: any): Organization {
		return {
			orgId: doc.orgId,
			slug: doc.slug,
			region: doc.region,
			tier: doc.tier,
			status: doc.status,
			permissions: doc.permissions,
			metadata: doc.metadata,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}
}
