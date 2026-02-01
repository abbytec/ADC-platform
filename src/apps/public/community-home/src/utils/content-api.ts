import type { LearningPath, Article } from "@ui-library/utils/connect-rpc";

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

const IS_DEV = process.env.NODE_ENV === "development";
const API_BASE = IS_DEV ? `http://${window.location.hostname}:3000/api/learning` : "/api/learning";

/**
 * Construye query string desde objeto de opciones
 */
function buildQueryString(options: Record<string, any>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined && value !== null) {
			params.append(key, String(value));
		}
	}
	const str = params.toString();
	return str ? `?${str}` : "";
}

/**
 * API de contenido usando REST
 */
export class ContentAPI {
	async listPaths(options?: ListPathsOptions): Promise<LearningPath[]> {
		const query = buildQueryString(options ?? {});
		const response = await fetch(`${API_BASE}/paths${query}`);
		const data = await response.json();
		return data.paths ?? [];
	}

	async getPath(slug: string): Promise<LearningPath | undefined> {
		const response = await fetch(`${API_BASE}/paths/${slug}`);
		if (!response.ok) return undefined;
		const data = await response.json();
		return data.path;
	}

	async listArticles(options?: ListArticlesOptions): Promise<Article[]> {
		const query = buildQueryString(options ?? {});
		const response = await fetch(`${API_BASE}/articles${query}`);
		const data = await response.json();
		return data.articles ?? [];
	}

	async getArticle(slug: string): Promise<Article | undefined> {
		const response = await fetch(`${API_BASE}/articles/${slug}`);
		if (!response.ok) return undefined;
		const data = await response.json();
		return data.article;
	}
}

export const contentAPI = new ContentAPI();
