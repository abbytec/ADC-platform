import type { Model, PipelineStage } from "mongoose";
import type { Article, LearningPath, PathItem } from "../../../../common/ADC/types/learning.js";

interface ListArticlesQuery {
	pathSlug?: string;
	listed?: string;
	authorId?: string;
	q?: string;
	limit?: string;
	skip?: string;
}

async function resolvePathSlugs(pathModel: Model<LearningPath>, pathSlug: string): Promise<string[] | null> {
	const parent = await pathModel.findOne({ slug: pathSlug }).select("items").lean();
	if (!parent?.items?.length) return null;

	const direct = parent.items.filter((i: PathItem) => i.type === "article").map((i: PathItem) => i.slug);
	const subPathSlugs = parent.items.filter((i: PathItem) => i.type === "path").map((i: PathItem) => i.slug);

	if (subPathSlugs.length === 0) return [...new Set(direct)];

	const subPaths = await pathModel
		.find({ slug: { $in: subPathSlugs } })
		.select("items")
		.lean();
	const fromSubs = subPaths.flatMap((sp) => (sp.items || []).filter((i: PathItem) => i.type === "article").map((i: PathItem) => i.slug));
	return [...new Set([...direct, ...fromSubs])];
}

export async function buildArticleListPipeline(
	articleModel: Model<Article>,
	pathModel: Model<LearningPath>,
	query: ListArticlesQuery
): Promise<Article[]> {
	const where: Record<string, any> = {};

	if (query.pathSlug) {
		const slugs = await resolvePathSlugs(pathModel, query.pathSlug);
		if (slugs === null) return [];
		where.slug = { $in: slugs };
	}

	if (query.listed !== undefined) where.listed = query.listed === "true";
	if (query.authorId) where.authorId = query.authorId;

	if (query.q) {
		const safe = query.q.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
		where.title = { $regex: safe, $options: "i" };
	}

	const pipeline: PipelineStage[] = [
		{ $match: where },
		{ $lookup: { from: "learningpaths", localField: "pathSlug", foreignField: "slug", as: "lp" } },
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

	const limit = query.limit ? Number.parseInt(query.limit) : undefined;
	const skip = query.skip ? Number.parseInt(query.skip) : undefined;
	if (skip) pipeline.push({ $skip: skip });
	if (limit) pipeline.push({ $limit: Math.min(limit, 200) });

	return articleModel.aggregate(pipeline) as Promise<Article[]>;
}
