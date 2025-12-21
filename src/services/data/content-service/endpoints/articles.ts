import type { Model, PipelineStage } from "mongoose";
import { create } from "@bufbuild/protobuf";
import {
	type Article,
	type ListArticlesRequest,
	type CreateArticleRequest,
	type UpdateArticleRequest,
	ArticleSchema,
	ListArticlesResponseSchema,
	GetArticleResponseSchema,
	CreateArticleResponseSchema,
	UpdateArticleResponseSchema,
	DeleteArticleResponseSchema,
	LearningPath,
	PathItem,
	PathItemType,
} from "../../../../common/ADC/gen/learning/learning_pb.js";

// Tipo extendido para resultados de aggregation (incluye pathColor)
type ArticleWithPathColor = Article & { pathColor?: string };

function docToProto(doc: ArticleWithPathColor): Article {
	return create(ArticleSchema, {
		slug: doc.slug,
		title: doc.title,
		pathSlug: doc.pathSlug,
		// Blocks se almacenan como Mixed en MongoDB y son compatibles en runtime
		blocks: (doc.blocks || []) as unknown as Article["blocks"],
		videoUrl: doc.videoUrl,
		image: doc.image,
		authorId: doc.authorId,
		listed: doc.listed,
		description: doc.description,
		pathColor: doc.pathColor,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	});
}

export class ArticleEndpoints {
	private static model: Model<Article>;
	private static pathModel: Model<LearningPath>;

	static init(model: Model<any>, pathModel: Model<any>) {
		ArticleEndpoints.model ??= model;
		ArticleEndpoints.pathModel ??= pathModel;
	}

	static async list(req: ListArticlesRequest) {
		const where: Record<string, any> = {};

		// Filtro por path (incluye artículos de sub-paths)
		if (req.pathSlug) {
			const parentPath = await ArticleEndpoints.pathModel.findOne({ slug: req.pathSlug }).select("items").lean();

			if (parentPath?.items?.length) {
				const targetArticleSlugs: string[] = [];

				const directArticles = parentPath.items.filter((i: PathItem) => i.type === PathItemType.ARTICLE).map((i: PathItem) => i.slug);
				targetArticleSlugs.push(...directArticles);

				const subPathSlugs = parentPath.items.filter((i: PathItem) => i.type === PathItemType.PATH).map((i: PathItem) => i.slug);

				if (subPathSlugs.length > 0) {
					const subPaths = await ArticleEndpoints.pathModel
						.find({ slug: { $in: subPathSlugs } })
						.select("items")
						.lean();

					subPaths.forEach((sp) => {
						if (sp.items) {
							const subArticles = sp.items.filter((i: PathItem) => i.type === PathItemType.ARTICLE).map((i: PathItem) => i.slug);
							targetArticleSlugs.push(...subArticles);
						}
					});
				}

				where.slug = { $in: [...new Set(targetArticleSlugs)] };
			} else {
				return create(ListArticlesResponseSchema, { articles: [] });
			}
		}

		if (req.listed !== undefined) where.listed = req.listed;

		if (req.q) {
			const safe = req.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

		if (req.limit) pipeline.push({ $limit: req.limit });
		if (req.skip) pipeline.push({ $skip: req.skip });

		const docs = await ArticleEndpoints.model.aggregate(pipeline);

		return create(ListArticlesResponseSchema, {
			articles: docs.map(docToProto),
		});
	}

	static async getBySlug(slug: string) {
		const doc = await ArticleEndpoints.model.findOne({ slug }).lean();

		return create(GetArticleResponseSchema, {
			article: doc ? docToProto(doc as ArticleWithPathColor) : undefined,
		});
	}

	static async create(req: CreateArticleRequest) {
		const data = {
			slug: req.slug,
			title: req.title,
			pathSlug: req.pathSlug,
			blocks: req.blocks,
			videoUrl: req.videoUrl,
			image: req.image,
			authorId: req.authorId,
			listed: req.listed ?? true,
			description: req.description,
		};

		const doc = await ArticleEndpoints.model.create(data);

		return create(CreateArticleResponseSchema, {
			article: docToProto(doc.toObject()),
		});
	}

	static async update(req: UpdateArticleRequest) {
		const data: Record<string, any> = {};
		if (req.title !== undefined) data.title = req.title;
		if (req.pathSlug !== undefined) data.pathSlug = req.pathSlug;
		if (req.blocks.length > 0) data.blocks = req.blocks;
		if (req.videoUrl !== undefined) data.videoUrl = req.videoUrl;
		if (req.image !== undefined) data.image = req.image;
		if (req.listed !== undefined) data.listed = req.listed;
		if (req.description !== undefined) data.description = req.description;

		const doc = await ArticleEndpoints.model.findOneAndUpdate({ slug: req.slug }, data, { new: true }).lean();

		if (!doc) {
			throw new Error(`Article with slug "${req.slug}" not found`);
		}

		return create(UpdateArticleResponseSchema, {
			article: docToProto(doc as ArticleWithPathColor),
		});
	}

	static async delete(slug: string) {
		const result = await ArticleEndpoints.model.deleteOne({ slug });

		return create(DeleteArticleResponseSchema, {
			success: result.deletedCount > 0,
		});
	}
}
