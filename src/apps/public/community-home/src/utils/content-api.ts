import { rpcClient, type RPCResponse } from "@ui-library/utils/connect-rpc";

// ========= Types (matching backend) =========
export interface ImageMeta {
	url: string;
	width?: number;
	height?: number;
	alt?: string;
}

export interface LearningPathItem {
	slug: string;
	type: "article" | "path";
	level: "critico" | "importante" | "opcional";
}

export interface LearningPath {
	slug: string;
	title: string;
	description: string;
	color: string;
	banner?: ImageMeta;
	public: boolean;
	listed: boolean;
	items: LearningPathItem[];
	createdAt: string;
	updatedAt: string;
}

export interface Article {
	slug: string;
	title: string;
	pathSlug?: string;
	pathColor?: string;
	blocks?: any[];
	videoUrl?: string;
	image?: ImageMeta;
	authorId: string;
	listed: boolean;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

// ========= Content API Client =========
export class ContentAPI {
	private readonly SERVICE = "ContentService";

	// ===== Learning Paths =====
	async listPaths(options?: { public?: boolean; listed?: boolean; limit?: number; skip?: number }): Promise<
		RPCResponse<LearningPath[]>
	> {
		return rpcClient.call(this.SERVICE, "ListPaths", options || {});
	}

	async getPath(slug: string): Promise<RPCResponse<LearningPath | null>> {
		return rpcClient.call(this.SERVICE, "GetPath", { slug });
	}

	// ===== Articles =====
	async listArticles(options?: { listed?: boolean; pathSlug?: string; q?: string; limit?: number; skip?: number }): Promise<
		RPCResponse<Article[]>
	> {
		return rpcClient.call(this.SERVICE, "ListArticles", options || {});
	}

	async getArticle(slug: string): Promise<RPCResponse<Article | null>> {
		return rpcClient.call(this.SERVICE, "GetArticle", { slug });
	}
}

export const contentAPI = new ContentAPI();
