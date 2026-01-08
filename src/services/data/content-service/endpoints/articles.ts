import type { Model, PipelineStage } from "mongoose";
import type { Article, LearningPath, PathItem, Block } from "../../../../common/ADC/types/learning.js";
import { RegisterEndpoint, HttpError, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";

interface ListArticlesQuery {
	pathSlug?: string;
	listed?: string;
	q?: string;
	limit?: string;
	skip?: string;
}

interface CreateArticleBody {
	slug: string;
	title: string;
	pathSlug?: string;
	blocks?: Block[];
	videoUrl?: string;
	image?: { url: string; width?: number; height?: number; alt?: string };
	authorId: string;
	listed?: boolean;
	description?: string;
}

interface UpdateArticleBody {
	title?: string;
	pathSlug?: string;
	blocks?: Block[];
	videoUrl?: string;
	image?: { url: string; width?: number; height?: number; alt?: string };
	listed?: boolean;
	description?: string;
}

interface SlugParams {
	slug: string;
}

export class ArticleEndpoints {
	private static model: Model<Article>;
	private static pathModel: Model<LearningPath>;

	static init(model: Model<any>, pathModel: Model<any>) {
		ArticleEndpoints.model ??= model;
		ArticleEndpoints.pathModel ??= pathModel;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/learning/articles",
		permissions: [],
	})
	static async list(ctx: EndpointCtx<Record<string, string>, never>): Promise<{ articles: Article[] }> {
		const query = ctx.query as ListArticlesQuery;
		const where: Record<string, any> = {};

		// Filtro por path (incluye artículos de sub-paths)
		if (query.pathSlug) {
			const parentPath = await ArticleEndpoints.pathModel.findOne({ slug: query.pathSlug }).select("items").lean();

			if (parentPath?.items?.length) {
				const targetArticleSlugs: string[] = [];

				const directArticles = parentPath.items.filter((i: PathItem) => i.type === "article").map((i: PathItem) => i.slug);
				targetArticleSlugs.push(...directArticles);

				const subPathSlugs = parentPath.items.filter((i: PathItem) => i.type === "path").map((i: PathItem) => i.slug);

				if (subPathSlugs.length > 0) {
					const subPaths = await ArticleEndpoints.pathModel
						.find({ slug: { $in: subPathSlugs } })
						.select("items")
						.lean();

					subPaths.forEach((sp) => {
						if (sp.items) {
							const subArticles = sp.items.filter((i: PathItem) => i.type === "article").map((i: PathItem) => i.slug);
							targetArticleSlugs.push(...subArticles);
						}
					});
				}

				where.slug = { $in: [...new Set(targetArticleSlugs)] };
			} else {
				return { articles: [] };
			}
		}

		if (query.listed !== undefined) where.listed = query.listed === "true";

		if (query.q) {
			const safe = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			where.title = { $regex: safe, $options: "i" };
		}

		const pipeline: PipelineStage[] = [
			{ $match: where },
			{
				$lookup: {
					from: "learningpaths",
					localField: "pathSlug",
					foreignField: "slug",
					as: "lp",
				},
			},
			{ $unwind: { path: "$lp", preserveNullAndEmptyArrays: true } },
			{ $addFields: { pathColor: "$lp.color" } },
			{
				$project: {
					_id: 0,
					slug: 1,
					title: 1,
					pathSlug: 1,
					pathColor: 1,
					description: 1,
					blocks: 1,
					videoUrl: 1,
					image: 1,
					authorId: 1,
					createdAt: 1,
					updatedAt: 1,
					listed: 1,
				},
			},
			{ $sort: { createdAt: -1 } },
		];

		const limit = query.limit ? parseInt(query.limit) : undefined;
		const skip = query.skip ? parseInt(query.skip) : undefined;

		if (limit) pipeline.push({ $limit: limit });
		if (skip) pipeline.push({ $skip: skip });

		const docs = await ArticleEndpoints.model.aggregate(pipeline);

		return { articles: docs };
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/learning/articles/:slug",
		permissions: [],
	})
	static async getBySlug(ctx: EndpointCtx<SlugParams>): Promise<{ article: Article }> {
		const { slug } = ctx.params;
		const doc = await ArticleEndpoints.model.findOne({ slug }).lean();

		if (!doc) {
			throw new HttpError(404, "ARTICLE_NOT_FOUND", "Article not found");
		}

		return { article: doc as Article };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/learning/articles",
		permissions: ["content.write"],
	})
	static async create(ctx: EndpointCtx<Record<string, string>, CreateArticleBody>): Promise<{ article: Article }> {
		const data = ctx.data;

		if (!data.slug || !data.title || !data.authorId) {
			throw new HttpError(400, "MISSING_FIELDS", "slug, title and authorId are required");
		}

		const doc = await ArticleEndpoints.model.create({
			...data,
			listed: data.listed ?? true,
		});

		return { article: doc.toObject() as Article };
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/learning/articles/:slug",
		permissions: ["content.write"],
	})
	static async update(ctx: EndpointCtx<SlugParams, UpdateArticleBody>): Promise<{ article: Article }> {
		const { slug } = ctx.params;
		const updateData = ctx.data;

		// Filtrar campos undefined
		const cleanData: Record<string, any> = {};
		for (const [key, value] of Object.entries(updateData || {})) {
			if (value !== undefined) cleanData[key] = value;
		}

		const doc = await ArticleEndpoints.model.findOneAndUpdate({ slug }, cleanData, { new: true }).lean();

		if (!doc) {
			throw new HttpError(404, "ARTICLE_NOT_FOUND", `Article with slug "${slug}" not found`);
		}

		return { article: doc as Article };
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/learning/articles/:slug",
		permissions: ["content.delete"],
	})
	static async delete(ctx: EndpointCtx<SlugParams>): Promise<{ success: boolean }> {
		const { slug } = ctx.params;
		const result = await ArticleEndpoints.model.deleteOne({ slug });

		if (result.deletedCount === 0) {
			throw new HttpError(404, "ARTICLE_NOT_FOUND", `Article with slug "${slug}" not found`);
		}

		return { success: true };
	}
}
