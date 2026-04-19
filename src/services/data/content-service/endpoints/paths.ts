import type { Model } from "mongoose";
import type { LearningPath, Article, PathItem } from "../../../../common/ADC/types/learning.js";
import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.ts";
import { P } from "@common/types/Permissions.ts";
import { canPublish } from "../utils/community-perms.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;

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

		if (query.public === "true") filter.public = true;
		if (query.listed === "true") filter.listed = true;

		const limit = query.limit ? Number.parseInt(query.limit) : 100;
		const skip = query.skip ? Number.parseInt(query.skip) : 0;

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

	@RegisterEndpoint({
		method: "POST",
		url: "/api/learning/paths",
		permissions: [P.COMMUNITY.CONTENT.WRITE],
		options: { rateLimit: { max: 1, timeWindow: 86_400_000 } },
	})
	static async create(ctx: EndpointCtx<Record<string, string>, CreatePathBody>): Promise<{ path: LearningPath }> {
		const data = ctx.data;
		const user = ctx.user;

		if (!data.slug || !data.title || !data.color) throw new HttpError(400, "MISSING_FIELDS", "slug, title and color are required");
		if (!SLUG_RE.test(data.slug)) throw new HttpError(400, "INVALID_SLUG", "Invalid slug format");

		const allowPublish = canPublish(user);
		try {
			const doc = await PathEndpoints.model.create({
				...data,
				description: allowPublish ? (data.description ?? "") : "",
				public: data.public ?? true,
				listed: allowPublish ? (data.listed ?? false) : false,
			});
			return { path: doc.toObject() as LearningPath };
		} catch (err: any) {
			if (err?.code === 11000) throw new HttpError(409, "SLUG_TAKEN", "Slug already exists");
			throw err;
		}
	}

	@RegisterEndpoint({ method: "PUT", url: "/api/learning/paths/:slug", permissions: [P.COMMUNITY.CONTENT.WRITE] })
	static async update(ctx: EndpointCtx<SlugParams, UpdatePathBody>): Promise<{ path: LearningPath }> {
		const { slug } = ctx.params;
		const user = ctx.user;
		const allowPublish = canPublish(user);

		const cleanData: Record<string, any> = {};
		for (const [key, value] of Object.entries(ctx.data || {})) {
			if (value === undefined) continue;
			if ((key === "listed" || key === "description") && !allowPublish) continue;
			if (key === "slug") continue;
			cleanData[key] = value;
		}

		const doc = await PathEndpoints.model.findOneAndUpdate({ slug }, cleanData, { new: true }).lean();
		if (!doc) throw new HttpError(404, "PATH_NOT_FOUND", `Path with slug "${slug}" not found`);
		return { path: doc as LearningPath };
	}

	@RegisterEndpoint({ method: "DELETE", url: "/api/learning/paths/:slug", permissions: [P.COMMUNITY.CONTENT.DELETE] })
	static async delete(ctx: EndpointCtx<SlugParams>): Promise<{ success: boolean }> {
		const { slug } = ctx.params;
		const existing = await PathEndpoints.model.findOne({ slug }).select("listed").lean();
		if (!existing) throw new HttpError(404, "PATH_NOT_FOUND", `Path with slug "${slug}" not found`);
		if (existing.listed && !canPublish(ctx.user)) throw new HttpError(403, "FORBIDDEN", "Cannot delete a published path");

		await PathEndpoints.model.deleteOne({ slug });
		return { success: true };
	}
}
