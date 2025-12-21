import { BaseService } from "../../BaseService.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import type { IHostBasedHttpProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import { LearningPathSchema } from "./models/path.model.js";
import { ArticleSchema } from "./models/article.model.js";
import { PathEndpoints } from "./endpoints/paths.js";
import { ArticleEndpoints } from "./endpoints/articles.js";
import { Article, LearningPath, LearningService } from "../../../common/ADC/gen/learning/learning_pb.js";

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

		await this.registerConnectRPC();

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

	private async registerConnectRPC(): Promise<void> {
		try {
			const httpProvider = this.kernel.getProvider<IHostBasedHttpProvider>("http-server-provider");

			if (!httpProvider) {
				this.logger.logWarn("[ContentService] No se pudo obtener httpProvider");
				return;
			}

			await httpProvider.registerConnectRPC((router) => {
				router.service(LearningService, {
					listPaths: (req) => PathEndpoints.list(req),
					getPath: (req) => PathEndpoints.getBySlug(req.slug),
					createPath: (req) => PathEndpoints.create(req),
					updatePath: (req) => PathEndpoints.update(req),
					deletePath: (req) => PathEndpoints.delete(req.slug),

					listArticles: (req) => ArticleEndpoints.list(req),
					getArticle: (req) => ArticleEndpoints.getBySlug(req.slug),
					createArticle: (req) => ArticleEndpoints.create(req),
					updateArticle: (req) => ArticleEndpoints.update(req),
					deleteArticle: (req) => ArticleEndpoints.delete(req.slug),
				});
			});

			this.logger.logOk("Connect RPC registrado: LearningService");
		} catch (error: any) {
			this.logger.logError(`Error registrando Connect RPC: ${error.message}`);
			throw error;
		}
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
	}
}
