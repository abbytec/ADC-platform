import type { Model } from "mongoose";
import type { LearningPath, Article, PathItem } from "../../../../common/ADC/types/learning.js";
import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.ts";

interface ListPathsQuery {
	public?: string;
	listed?: string;
	limit?: string;
	skip?: string;
}

interface CreatePathBody {
	slug: string;
	title: string;
	description: string;
	color: string;
	banner?: { url: string; width?: number; height?: number; alt?: string };
	public?: boolean;
	listed?: boolean;
	items?: Array<{ slug: string; type: string; level?: string }>;
}

interface UpdatePathBody {
	title?: string;
	description?: string;
	color?: string;
	banner?: { url: string; width?: number; height?: number; alt?: string };
	public?: boolean;
	listed?: boolean;
	items?: Array<{ slug: string; type: string; level?: string }>;
}

interface SlugParams {
	slug: string;
}

// PathItem con elemento poblado
interface PopulatedPathItem extends PathItem {
	element?: Article | LearningPath;
}

export class PathEndpoints {
	private static model: Model<LearningPath>;
	private static articleModel: Model<Article>;

	static init(model: Model<any>, articleModel: Model<any>) {
		PathEndpoints.model ??= model;
		PathEndpoints.articleModel ??= articleModel;
	}

	@RegisterEndpoint({ method: "GET", url: "/api/learning/paths" })
	static async list(ctx: EndpointCtx): Promise<{ paths: LearningPath[] }> {
		const query = ctx.query as ListPathsQuery;
		const filter: Record<string, any> = {};

		if (query.public !== undefined) filter.public = query.public === "true";
		if (query.listed !== undefined) filter.listed = query.listed === "true";

		const limit = query.limit ? parseInt(query.limit) : 100;
		const skip = query.skip ? parseInt(query.skip) : 0;

		const docs = await PathEndpoints.model.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }).lean();

		return { paths: docs as LearningPath[] };
	}

	@RegisterEndpoint({ method: "GET", url: "/api/learning/paths/:slug" })
	static async getBySlug(ctx: EndpointCtx<SlugParams>): Promise<{ path: LearningPath & { items: PopulatedPathItem[] } }> {
		const { slug } = ctx.params;
		const doc = await PathEndpoints.model.findOne({ slug }).lean<LearningPath | null>();

		if (!doc) throw new HttpError(404, "PATH_NOT_FOUND", "Path not found");

		// Extraer slugs por tipo para queries batch
		const articleSlugs = doc.items.filter((i) => i.type === "article").map((i) => i.slug);
		const nestedPathSlugs = doc.items
			.filter((i) => i.type === "path")
			.map((i) => i.slug)
			.filter((s) => s && s !== slug); // Evitar auto-referencia

		// Queries batch para artículos y paths
		const [articles, nestedPaths] = await Promise.all([
			articleSlugs.length
				? PathEndpoints.articleModel
						.find({ slug: { $in: articleSlugs }, listed: true })
						.select("slug title description image pathColor")
						.lean<Article[]>()
				: [],
			nestedPathSlugs.length
				? PathEndpoints.model
						.find({ slug: { $in: nestedPathSlugs }, public: true })
						.select("slug title description color banner")
						.lean<LearningPath[]>()
				: [],
		]);

		// Crear mapas para lookup O(1)
		const articleMap = new Map(articles.map((a) => [a.slug, a]));
		const pathMap = new Map(nestedPaths.map((p) => [p.slug, p]));

		// Poblar items filtrando los que no existen
		const populatedItems: PopulatedPathItem[] = [];
		for (const item of doc.items) {
			const element = item.type === "article" ? articleMap.get(item.slug) : pathMap.get(item.slug);
			if (element) populatedItems.push({ ...item, element });
		}

		return { path: { ...doc, items: populatedItems } };
	}

	@RegisterEndpoint({ method: "POST", url: "/api/learning/paths", permissions: ["content.write"] })
	static async create(ctx: EndpointCtx<Record<string, string>, CreatePathBody>): Promise<{ path: LearningPath }> {
		const data = ctx.data;

		if (!data.slug || !data.title || !data.description || !data.color)
			throw new HttpError(400, "MISSING_FIELDS", "slug, title, description and color are required");

		const doc = await PathEndpoints.model.create({
			...data,
			public: data.public ?? true,
			listed: data.listed ?? true,
		});

		return { path: doc.toObject() as LearningPath };
	}

	@RegisterEndpoint({ method: "PUT", url: "/api/learning/paths/:slug", permissions: ["content.write"] })
	static async update(ctx: EndpointCtx<SlugParams, UpdatePathBody>): Promise<{ path: LearningPath }> {
		const { slug } = ctx.params;
		const updateData = ctx.data;

		// Filtrar campos undefined
		const cleanData: Record<string, any> = {};
		for (const [key, value] of Object.entries(updateData || {})) {
			if (value !== undefined) cleanData[key] = value;
		}

		const doc = await PathEndpoints.model.findOneAndUpdate({ slug }, cleanData, { new: true }).lean();

		if (!doc) throw new HttpError(404, "PATH_NOT_FOUND", `Path with slug "${slug}" not found`);

		return { path: doc as LearningPath };
	}

	@RegisterEndpoint({ method: "DELETE", url: "/api/learning/paths/:slug", permissions: ["content.delete"] })
	static async delete(ctx: EndpointCtx<SlugParams>): Promise<{ success: boolean }> {
		const { slug } = ctx.params;
		const result = await PathEndpoints.model.deleteOne({ slug });

		if (result.deletedCount === 0) throw new HttpError(404, "PATH_NOT_FOUND", `Path with slug "${slug}" not found`);

		return { success: true };
	}
}
