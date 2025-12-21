import { BaseService } from "../../BaseService.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import { LearningPathSchema, type ILearningPath } from "./models/path.model.js";
import { ArticleSchema, type IArticle } from "./models/article.model.js";
import { PathEndpoints } from "./endpoints/paths.js";
import { ArticleEndpoints } from "./endpoints/articles.js";

export default class ContentService extends BaseService {
	public readonly name = "content-service";
	private mongoProvider!: IMongoProvider;

	async start(kernelKey: symbol): Promise<void> {
		super.start(kernelKey);
		this.logger.logInfo("Iniciando servicio de contenido...");

		this.mongoProvider = this.kernel.getProvider<IMongoProvider>("object-provider");

		await this.waitForMongo();

		const PathModel = this.mongoProvider.createModel<ILearningPath>("LearningPath", LearningPathSchema);
		const ArticleModel = this.mongoProvider.createModel<IArticle>("Article", ArticleSchema);

		PathEndpoints.init(PathModel);
		ArticleEndpoints.init(ArticleModel, PathModel);

		await this.registerRPCRoutes();

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

	private async registerRPCRoutes(): Promise<void> {
		try {
			const httpProvider = this.kernel.getProvider<any>("http-server-provider");

			if (!httpProvider) {
				this.logger.logWarn("[ContentService] No se pudo obtener httpProvider");
				return;
			}

			const basePath = "/api/rpc/ContentService";

			// Paths endpoints
			httpProvider.registerRoute("POST", `${basePath}/ListPaths`, async (req: any, res: any) => {
				const paths = await PathEndpoints.list(req.body || {});
				res.json(paths);
			});

			httpProvider.registerRoute("POST", `${basePath}/GetPath`, async (req: any, res: any) => {
				const path = await PathEndpoints.getBySlug(req.body.slug);
				res.json(path);
			});

			httpProvider.registerRoute("POST", `${basePath}/CreatePath`, async (req: any, res: any) => {
				const path = await PathEndpoints.create(req.body);
				res.json(path);
			});

			httpProvider.registerRoute("POST", `${basePath}/UpdatePath`, async (req: any, res: any) => {
				const { slug, ...data } = req.body;
				const path = await PathEndpoints.update(slug, data);
				res.json(path);
			});

			httpProvider.registerRoute("POST", `${basePath}/DeletePath`, async (req: any, res: any) => {
				const result = await PathEndpoints.delete(req.body.slug);
				res.json(result);
			});

			// Articles endpoints
			httpProvider.registerRoute("POST", `${basePath}/ListArticles`, async (req: any, res: any) => {
				const articles = await ArticleEndpoints.list(req.body || {});
				res.json(articles);
			});

			httpProvider.registerRoute("POST", `${basePath}/GetArticle`, async (req: any, res: any) => {
				const article = await ArticleEndpoints.getBySlug(req.body.slug);
				res.json(article);
			});

			httpProvider.registerRoute("POST", `${basePath}/CreateArticle`, async (req: any, res: any) => {
				const article = await ArticleEndpoints.create(req.body);
				res.json(article);
			});

			httpProvider.registerRoute("POST", `${basePath}/UpdateArticle`, async (req: any, res: any) => {
				const { slug, ...data } = req.body;
				const article = await ArticleEndpoints.update(slug, data);
				res.json(article);
			});

			httpProvider.registerRoute("POST", `${basePath}/DeleteArticle`, async (req: any, res: any) => {
				const result = await ArticleEndpoints.delete(req.body.slug);
				res.json(result);
			});

			this.logger.logOk("[ContentService] Rutas RPC registradas");
		} catch (error: any) {
			this.logger.logError(`[ContentService] Error registrando rutas RPC: ${error.message}`);
			throw error;
		}
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
	}
}
