import { learningClient, type LearningPath, type Article } from "@ui-library/utils/connect-rpc";

// Re-exportar tipos para compatibilidad
export type { LearningPath, Article } from "@ui-library/utils/connect-rpc";

// Tipos simplificados para los parámetros de la API
interface ListPathsOptions {
	public?: boolean;
	listed?: boolean;
	limit?: number;
	skip?: number;
}

interface ListArticlesOptions {
	pathSlug?: string;
	listed?: boolean;
	q?: string;
	limit?: number;
	skip?: number;
}

/**
 * API de contenido usando Connect RPC tipado
 */
export class ContentAPI {
	async listPaths(options?: ListPathsOptions): Promise<LearningPath[]> {
		const response = await learningClient.listPaths(options ?? {});
		return response.paths;
	}

	async getPath(slug: string): Promise<LearningPath | undefined> {
		const response = await learningClient.getPath({ slug });
		return response.path;
	}

	async listArticles(options?: ListArticlesOptions): Promise<Article[]> {
		const response = await learningClient.listArticles(options ?? {});
		return response.articles;
	}

	async getArticle(slug: string): Promise<Article | undefined> {
		const response = await learningClient.getArticle({ slug });
		return response.article;
	}
}

export const contentAPI = new ContentAPI();
