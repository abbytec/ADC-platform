import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import { BaseService } from "../../BaseService.js";
import { projectSchema, sprintSchema, milestoneSchema, issueSchema } from "./domain/index.js";
import { ProjectManager, SprintManager, MilestoneManager, IssueManager } from "./dao/index.js";
import { type IAuthVerifier, type AuthVerifierGetter } from "@common/types/auth-verifier.ts";
import type IdentityManagerService from "../../core/IdentityManagerService/index.js";
import type { EndpointCtx } from "../../core/EndpointManagerService/index.js";
import { EnableEndpoints, DisableEndpoints } from "../../core/EndpointManagerService/index.js";
import { ProjectEndpoints } from "./endpoints/projects.js";
import { SprintEndpoints } from "./endpoints/sprints.js";
import { MilestoneEndpoints } from "./endpoints/milestones.js";
import { IssueEndpoints } from "./endpoints/issues.js";
import { PMScopes } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import type { Issue } from "@common/types/project-manager/Issue.ts";
import { Kernel } from "../../../kernel.ts";

/**
 * ProjectManagerService — gestión de proyectos tipo Jira.
 *
 * Usa IdentityManagerService para auth/permisos (delega verifyToken/hasPermission).
 * Persiste en la DB global `adc-core` (multi-tenant por campo `orgId`).
 */
export default class ProjectManagerService extends BaseService {
	public readonly name = "ProjectManagerService";

	#projectManager: ProjectManager | null = null;
	#sprintManager: SprintManager | null = null;
	#milestoneManager: MilestoneManager | null = null;
	#issueManager: IssueManager | null = null;

	#authVerifier: IAuthVerifier | null = null;
	#identity: IdentityManagerService | null = null;

	private mongoProvider!: IMongoProvider;
	readonly #kernelRef: Kernel;

	constructor(kernel: Kernel, options?: any) {
		super(kernel, options);
		this.#kernelRef = kernel;
	}

	#getAuthVerifier: AuthVerifierGetter = () => this.#authVerifier;

	@EnableEndpoints({
		managers: () => [ProjectEndpoints, SprintEndpoints, MilestoneEndpoints, IssueEndpoints],
	})
	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		this.mongoProvider = this.getMyProvider<IMongoProvider>("object/mongo");
		await this.waitForMongo();

		// Identity para delegar auth/permisos (kernel service, acceso via registry)
		this.#identity = this.#kernelRef.registry.getService<IdentityManagerService>("IdentityManagerService");

		// Crear modelos
		const ProjectModel = this.mongoProvider.createModel<Project>("projects", projectSchema);
		const SprintModel = this.mongoProvider.createModel<Sprint>("sprints", sprintSchema);
		const MilestoneModel = this.mongoProvider.createModel<Milestone>("milestones", milestoneSchema);
		const IssueModel = this.mongoProvider.createModel<Issue>("issues", issueSchema);

		// Managers
		this.#projectManager = new ProjectManager(ProjectModel, this.logger, this.#getAuthVerifier);
		this.#sprintManager = new SprintManager(SprintModel, this.logger, this.#getAuthVerifier);
		this.#milestoneManager = new MilestoneManager(MilestoneModel, this.logger, this.#getAuthVerifier);
		this.#issueManager = new IssueManager(IssueModel, this.#projectManager, this.logger, this.#getAuthVerifier);

		// AuthVerifier delegado a Identity
		this.#authVerifier = this.#identity.createAuthVerifier();

		// Init endpoints
		ProjectEndpoints.init(this);
		SprintEndpoints.init(this);
		MilestoneEndpoints.init(this);
		IssueEndpoints.init(this);

		this.logger.logOk("ProjectManagerService iniciado");
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Contexto de listado de proyectos (endpoint-level helper)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Resuelve el contexto del caller (userId, groupIds, global PM read, admin)
	 * y delega a ProjectManager.listVisibleProjects.
	 */
	async listProjectsForCaller(ctx: EndpointCtx): Promise<Project[]> {
		const user = ctx.user;
		const userId = user?.id ?? "";
		const callerOrgId = user?.orgId;
		const identity = this.#identity!;

		// Resolver groupIds del usuario (best-effort: Identity puede no estar disponible)
		let groupIds: string[] = [];
		try {
			const full = userId ? await identity.users.getUser(userId, ctx.token ?? undefined) : null;
			groupIds = full?.groupIds ?? [];
		} catch {
			groupIds = [];
		}

		const hasGlobalPMRead = await identity.permissions.hasPermission(userId, CRUDXAction.READ, PMScopes.PROJECTS);
		// Admin global = usuario sin orgId con permisos completos sobre el recurso
		const isGlobalAdmin = !callerOrgId && (await identity.permissions.hasPermission(userId, CRUDXAction.CRUD, PMScopes.ALL));

		return this.projects.listVisibleProjects({ userId, groupIds, callerOrgId, hasGlobalPMRead, isGlobalAdmin }, ctx.token ?? undefined);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Getters
	// ─────────────────────────────────────────────────────────────────────────

	get projects(): ProjectManager {
		if (!this.#projectManager) throw new Error("ProjectManager not initialized");
		return this.#projectManager;
	}
	get sprints(): SprintManager {
		if (!this.#sprintManager) throw new Error("SprintManager not initialized");
		return this.#sprintManager;
	}
	get milestones(): MilestoneManager {
		if (!this.#milestoneManager) throw new Error("MilestoneManager not initialized");
		return this.#milestoneManager;
	}
	get issues(): IssueManager {
		if (!this.#issueManager) throw new Error("IssueManager not initialized");
		return this.#issueManager;
	}
	get identity(): IdentityManagerService {
		if (!this.#identity) throw new Error("IdentityManagerService not initialized");
		return this.#identity;
	}

	@DisableEndpoints()
	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		this.#authVerifier = null;
		this.logger.logOk("ProjectManagerService detenido");
	}

	private async waitForMongo(): Promise<void> {
		const maxWaitTime = 10000;
		const startTime = Date.now();

		while (!this.mongoProvider.isConnected() && Date.now() - startTime < maxWaitTime) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		if (!this.mongoProvider.isConnected()) {
			throw new Error("MongoDB no pudo conectarse en el tiempo esperado");
		}
	}
}
