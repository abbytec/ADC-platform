import { BaseService } from "../../BaseService.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import { LearningPathSchema } from "./models/path.model.js";
import { ArticleSchema } from "./models/article.model.js";
import { PathEndpoints } from "./endpoints/paths.js";
import { ArticleEndpoints } from "./endpoints/articles.js";
import { EnableEndpoints, DisableEndpoints } from "../../core/EndpointManagerService/index.js";
import type { LearningPath, Article } from "../../../common/ADC/types/learning.js";

export default class ContentService extends BaseService {
	public readonly name = "content-service";
	private mongoProvider!: IMongoProvider;

	@EnableEndpoints({ managers: () => [PathEndpoints, ArticleEndpoints] })
	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);
		this.logger.logInfo("Iniciando servicio de contenido...");

		this.mongoProvider = this.getMyProvider<IMongoProvider>("object/mongo");

		await this.waitForMongo();

		const PathModel = this.mongoProvider.createModel<LearningPath>("LearningPath", LearningPathSchema);
		const ArticleModel = this.mongoProvider.createModel<Article>("Article", ArticleSchema);

		PathEndpoints.init(PathModel, ArticleModel);
		ArticleEndpoints.init(ArticleModel, PathModel);

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

	@DisableEndpoints()
	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
	}
}
