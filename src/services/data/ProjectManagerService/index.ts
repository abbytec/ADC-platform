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
import { OnlyKernel } from "../../../utils/decorators/OnlyKernel.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import type { Issue } from "@common/types/project-manager/Issue.ts";
import type { CallerMembership } from "./dao/projects.ts";
import { Kernel } from "../../../kernel.ts";

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

		this.#identity = this.#kernelRef.registry.getService<IdentityManagerService>("IdentityManagerService");

		const ProjectModel = this.mongoProvider.createModel<Project>("projects", projectSchema);
		const SprintModel = this.mongoProvider.createModel<Sprint>("sprints", sprintSchema);
		const MilestoneModel = this.mongoProvider.createModel<Milestone>("milestones", milestoneSchema);
		const IssueModel = this.mongoProvider.createModel<Issue>("issues", issueSchema);

		this.#projectManager = new ProjectManager(ProjectModel, kernelKey, this.logger, this.#getAuthVerifier);
		this.#sprintManager = new SprintManager(SprintModel, this.logger, this.#getAuthVerifier);
		this.#milestoneManager = new MilestoneManager(MilestoneModel, this.logger, this.#getAuthVerifier);
		this.#issueManager = new IssueManager(IssueModel, this.#projectManager.getInternals(kernelKey), this.logger, this.#getAuthVerifier);

		this.#authVerifier = this.#identity.createAuthVerifier();

		ProjectEndpoints.init(this, kernelKey);
		SprintEndpoints.init(this);
		MilestoneEndpoints.init(this);
		IssueEndpoints.init(this, kernelKey);

		this.logger.logOk("ProjectManagerService iniciado");
	}

	/**
	 * Resuelve `userId` + `groupIds` del caller desde el token y cachea en `ctx`.
	 * Restringido a llamadas que posean la `kernelKey` del service (típicamente,
	 * los endpoints registrados vía `init(this, kernelKey)`).
	 */
	@OnlyKernel()
	async resolveCaller(_kernelKey: symbol, ctx: EndpointCtx): Promise<CallerMembership> {
		const cacheKey = Symbol.for("PMCallerMembership");
		const cached = (ctx as any)[cacheKey];
		if (cached) return cached;

		const userId = ctx.user?.id ?? "";
		let groupIds: string[] = [];
		if (userId) {
			try {
				const full = await this.identity.users.getUser(userId, ctx.token ?? undefined);
				groupIds = full?.groupIds ?? [];
			} catch {
				groupIds = [];
			}
		}
		const caller: CallerMembership = { userId, groupIds };
		Object.defineProperty(ctx, cacheKey, { value: caller, enumerable: false });
		return caller;
	}

	@OnlyKernel()
	async listProjectsForCaller(_kernelKey: symbol, ctx: EndpointCtx): Promise<Project[]> {
		const caller = await this.resolveCaller(_kernelKey, ctx);
		const identity = this.#identity!;
		const orgId = ctx.user?.orgId;

		const hasGlobalPMRead = await identity.permissions.hasPermission(caller.userId, CRUDXAction.READ, PMScopes.PROJECTS);
		const isGlobalAdmin = !orgId && (await identity.permissions.hasPermission(caller.userId, CRUDXAction.CRUD, PMScopes.ALL));

		return this.projects.listVisibleProjects(
			{ userId: caller.userId, groupIds: caller.groupIds, callerOrgId: orgId, hasGlobalPMRead, isGlobalAdmin },
			ctx.token ?? undefined
		);
	}

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
