// ========= Tipos compartidos =========
export interface ImageMeta {
	url: string;
	width?: number;
	height?: number;
	alt?: string;
}

export type Color = "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink";

// ========= Genéricos para Request/Response =========
export interface ListRequest {
	limit?: number;
	skip?: number;
}

export interface ListResponse<T> {
	items: T[];
	total: number;
}

export interface GetBySlugRequest {
	slug: string;
}

export interface GetBySlugResponse<T> {
	item: T | null;
}

export interface DeleteBySlugRequest {
	slug: string;
}

export interface DeleteBySlugResponse {
	success: boolean;
}

// ========= Paths specific requests =========
export interface ListPathsRequest extends ListRequest {
	public?: boolean;
	listed?: boolean;
}

// ========= Articles specific requests =========
export interface ListArticlesRequest extends ListRequest {
	listed?: boolean;
	pathSlug?: string;
}
