import type { Model, PipelineStage } from "mongoose";
import type { Article, LearningPath, PathItem, Block } from "../../../../common/ADC/types/learning.js";

interface ListArticlesOptions {
	pathSlug?: string;
	listed?: boolean;
	q?: string;
	limit?: number;
	skip?: number;
}

interface CreateArticleData {
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

interface UpdateArticleData {
	slug: string;
	title?: string;
	pathSlug?: string;
	blocks?: Block[];
	videoUrl?: string;
	image?: { url: string; width?: number; height?: number; alt?: string };
	listed?: boolean;
	description?: string;
}

export class ArticleEndpoints {
	private static model: Model<Article>;
	private static pathModel: Model<LearningPath>;

	static init(model: Model<any>, pathModel: Model<any>) {
		ArticleEndpoints.model ??= model;
		ArticleEndpoints.pathModel ??= pathModel;
	}

	static async list(options: ListArticlesOptions) {
		const where: Record<string, any> = {};

		// Filtro por path (incluye artículos de sub-paths)
		if (options.pathSlug) {
			const parentPath = await ArticleEndpoints.pathModel.findOne({ slug: options.pathSlug }).select("items").lean();

			if (parentPath?.items?.length) {
				const targetArticleSlugs: string[] = [];

				const directArticles = parentPath.items.filter((i: PathItem) => i.type === "article").map((i: PathItem) => i.slug);
				targetArticleSlugs.push(...directArticles);

				const subPathSlugs = parentPath.items.filter((i: PathItem) => i.type === "path").map((i: PathItem) => i.slug);

				if (subPathSlugs.length > 0) {
					const subPaths = await ArticleEndpoints.pathModel.find({ slug: { $in: subPathSlugs } }).select("items").lean();

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

		if (options.listed !== undefined) where.listed = options.listed;

		if (options.q) {
			const safe = options.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

		if (options.limit) pipeline.push({ $limit: options.limit });
		if (options.skip) pipeline.push({ $skip: options.skip });

		const docs = await ArticleEndpoints.model.aggregate(pipeline);

		return { articles: docs };
	}

	static async getBySlug(slug: string) {
		const doc = await ArticleEndpoints.model.findOne({ slug }).lean();
		return { article: doc || undefined };
	}

	static async create(data: CreateArticleData) {
		const doc = await ArticleEndpoints.model.create({
			...data,
			listed: data.listed ?? true,
		});
		return { article: doc.toObject() };
	}

	static async update(data: UpdateArticleData) {
		const { slug, ...updateData } = data;

		// Filtrar campos undefined
		const cleanData: Record<string, any> = {};
		for (const [key, value] of Object.entries(updateData)) {
			if (value !== undefined) cleanData[key] = value;
		}

		const doc = await ArticleEndpoints.model.findOneAndUpdate({ slug }, cleanData, { new: true }).lean();

		if (!doc) {
			throw new Error(`Article with slug "${slug}" not found`);
		}

		return { article: doc };
	}

	static async delete(slug: string) {
		const result = await ArticleEndpoints.model.deleteOne({ slug });
		return { success: result.deletedCount > 0 };
	}
}
