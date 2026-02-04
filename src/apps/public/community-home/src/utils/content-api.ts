import type { LearningPath, Article } from "@ui-library/utils/connect-rpc";
import { createAdcApi } from "@ui-library/utils/adc-fetch";

// Re-exportar tipos para uso en componentes
export type { LearningPath, Article, Block, PathItemLevel } from "@ui-library/utils/connect-rpc";

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

interface ListPathsResponse {
	paths: LearningPath[];
}

interface GetPathResponse {
	path: LearningPath;
}

interface ListArticlesResponse {
	articles: Article[];
}

interface GetArticleResponse {
	article: Article;
}

/**
 * Content API client using createAdcApi
 * - No credentials needed for public content
 * - Automatic error handling via adc-custom-error
 */
const api = createAdcApi({
	basePath: "/api/learning",
	devPort: 3000,
});

export const contentAPI = {
	listPaths: async (options?: ListPathsOptions): Promise<LearningPath[]> => {
		const result = await api.get<ListPathsResponse>("/paths", { params: options as Record<string, string | number | boolean | undefined> });
		return result.data?.paths ?? [];
	},

	getPath: async (slug: string): Promise<LearningPath | undefined> => {
		const result = await api.get<GetPathResponse>(`/paths/${slug}`);
		return result.data?.path;
	},

	listArticles: async (options?: ListArticlesOptions): Promise<Article[]> => {
		const result = await api.get<ListArticlesResponse>("/articles", {
			params: options as Record<string, string | number | boolean | undefined>,
		});
		return result.data?.articles ?? [];
	},

	getArticle: async (slug: string): Promise<Article | undefined> => {
		const result = await api.get<GetArticleResponse>(`/articles/${slug}`);
		return result.data?.article;
	},
};
