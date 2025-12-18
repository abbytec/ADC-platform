import type { Model, PipelineStage } from "mongoose";
import type { IArticle } from "../models/article.model.js";
import type { ILearningPath } from "../models/path.model.js";

export class ArticleEndpoints {
	constructor(
		private model: Model<IArticle>,
		private pathModel: Model<ILearningPath>
	) {}

	async list(req: { listed?: boolean; pathSlug?: string; q?: string; limit?: number; skip?: number }) {
		const where: any = {};

		// Filtro por path (incluye artículos de sub-paths)
		if (req.pathSlug) {
			const parentPath = await this.pathModel.findOne({ slug: req.pathSlug }).select("items").lean();

			if (parentPath?.items?.length) {
				const targetArticleSlugs: string[] = [];

				// Artículos directos del path
				const directArticles = parentPath.items.filter((i) => i.type === "article").map((i) => i.slug);
				targetArticleSlugs.push(...directArticles);

				// Artículos de sub-paths
				const subPathSlugs = parentPath.items.filter((i) => i.type === "path").map((i) => i.slug);

				if (subPathSlugs.length > 0) {
					const subPaths = await this.pathModel.find({ slug: { $in: subPathSlugs } }).select("items").lean();

					subPaths.forEach((sp) => {
						if (sp.items) {
							const subArticles = sp.items.filter((i) => i.type === "article").map((i) => i.slug);
							targetArticleSlugs.push(...subArticles);
						}
					});
				}

				where.slug = { $in: [...new Set(targetArticleSlugs)] };
			} else {
				return [];
			}
		}

		// Filtro listed
		if (req.listed !== undefined) {
			where.listed = req.listed;
		}

		// Búsqueda por texto
		if (req.q) {
			const safe = req.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			where.title = { $regex: safe, $options: "i" };
		}

		// Aggregate para popular pathColor desde LearningPath
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
			{
				$addFields: {
					pathColor: "$lp.color",
				},
			},
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

		return await this.model.aggregate(pipeline);
	}

	async getBySlug(slug: string) {
		return await this.model.findOne({ slug }).lean();
	}

	async create(data: any) {
		const doc = await this.model.create(data);
		return doc.toObject();
	}

	async update(slug: string, data: any) {
		const doc = await this.model.findOneAndUpdate({ slug }, data, { new: true }).lean();

		if (!doc) {
			throw new Error(`Article with slug "${slug}" not found`);
		}

		return doc;
	}

	async delete(slug: string) {
		const result = await this.model.deleteOne({ slug });
		return { success: result.deletedCount > 0 };
	}
}
