import { BaseService } from "../../BaseService.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import type { IHostBasedHttpProvider, FastifyRequest, FastifyReply } from "../../../interfaces/modules/providers/IHttpServer.js";
import { LearningPathSchema } from "./models/path.model.js";
import { ArticleSchema } from "./models/article.model.js";
import { PathEndpoints } from "./endpoints/paths.js";
import { ArticleEndpoints } from "./endpoints/articles.js";
import type { LearningPath, Article } from "../../../common/ADC/types/learning.js";

export default class ContentService extends BaseService {
	public readonly name = "content-service";
	private mongoProvider!: IMongoProvider;

	async start(kernelKey: symbol): Promise<void> {
		super.start(kernelKey);
		this.logger.logInfo("Iniciando servicio de contenido...");

		this.mongoProvider = this.kernel.getProvider<IMongoProvider>("object-provider");

		await this.waitForMongo();

		const PathModel = this.mongoProvider.createModel<LearningPath>("LearningPath", LearningPathSchema);
		const ArticleModel = this.mongoProvider.createModel<Article>("Article", ArticleSchema);

		PathEndpoints.init(PathModel);
		ArticleEndpoints.init(ArticleModel, PathModel);

		await this.registerRESTRoutes();

		this.logger.logOk("[ContentService] Servicio de contenido iniciado correctamente");
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

	private async registerRESTRoutes(): Promise<void> {
		const httpProvider = this.kernel.getProvider<IHostBasedHttpProvider>("http-server-provider");

		if (!httpProvider) {
			this.logger.logWarn("[ContentService] No se pudo obtener httpProvider");
			return;
		}

		// === Learning Paths ===
		httpProvider.registerRoute("GET", "/api/learning/paths", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const query = req.query as { public?: string; listed?: string; limit?: string; skip?: string };
			const response = await PathEndpoints.list({
				public: query.public === "true",
				listed: query.listed === "true",
				limit: query.limit ? parseInt(query.limit) : undefined,
				skip: query.skip ? parseInt(query.skip) : undefined,
			});
			reply.send(response);
		});

		httpProvider.registerRoute("GET", "/api/learning/paths/:slug", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const { slug } = req.params as { slug: string };
			const response = await PathEndpoints.getBySlug(slug);
			if (!response.path) {
				reply.code(404).send({ error: "Path not found" });
				return;
			}
			reply.send(response);
		});

		httpProvider.registerRoute("POST", "/api/learning/paths", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const response = await PathEndpoints.create(req.body as Parameters<typeof PathEndpoints.create>[0]);
			reply.code(201).send(response);
		});

		httpProvider.registerRoute("PUT", "/api/learning/paths/:slug", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const { slug } = req.params as { slug: string };
			const body = req.body as Record<string, unknown>;
			const response = await PathEndpoints.update({ ...body, slug });
			reply.send(response);
		});

		httpProvider.registerRoute("DELETE", "/api/learning/paths/:slug", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const { slug } = req.params as { slug: string };
			const response = await PathEndpoints.delete(slug);
			reply.send(response);
		});

		// === Articles ===
		httpProvider.registerRoute("GET", "/api/learning/articles", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const query = req.query as { pathSlug?: string; listed?: string; q?: string; limit?: string; skip?: string };
			const response = await ArticleEndpoints.list({
				pathSlug: query.pathSlug,
				listed: query.listed === "true",
				q: query.q,
				limit: query.limit ? parseInt(query.limit) : undefined,
				skip: query.skip ? parseInt(query.skip) : undefined,
			});
			reply.send(response);
		});

		httpProvider.registerRoute("GET", "/api/learning/articles/:slug", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const { slug } = req.params as { slug: string };
			const response = await ArticleEndpoints.getBySlug(slug);
			if (!response.article) {
				reply.code(404).send({ error: "Article not found" });
				return;
			}
			reply.send(response);
		});

		httpProvider.registerRoute("POST", "/api/learning/articles", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const response = await ArticleEndpoints.create(req.body as Parameters<typeof ArticleEndpoints.create>[0]);
			reply.code(201).send(response);
		});

		httpProvider.registerRoute("PUT", "/api/learning/articles/:slug", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const { slug } = req.params as { slug: string };
			const body = req.body as Record<string, unknown>;
			const response = await ArticleEndpoints.update({ ...body, slug });
			reply.send(response);
		});

		httpProvider.registerRoute("DELETE", "/api/learning/articles/:slug", async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			const { slug } = req.params as { slug: string };
			const response = await ArticleEndpoints.delete(slug);
			reply.send(response);
		});

		this.logger.logOk("REST API registrada: /api/learning/*");
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
	}
}
