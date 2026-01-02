import type { Model } from "mongoose";
import type { LearningPath, Article, PathItem } from "../../../../common/ADC/types/learning.js";

interface ListPathsOptions {
	public?: boolean;
	listed?: boolean;
	limit?: number;
	skip?: number;
}

interface CreatePathData {
	slug: string;
	title: string;
	description: string;
	color: string;
	banner?: { url: string; width?: number; height?: number; alt?: string };
	public?: boolean;
	listed?: boolean;
	items?: Array<{ slug: string; type: string; level?: string }>;
}

interface UpdatePathData {
	slug: string;
	title?: string;
	description?: string;
	color?: string;
	banner?: { url: string; width?: number; height?: number; alt?: string };
	public?: boolean;
	listed?: boolean;
	items?: Array<{ slug: string; type: string; level?: string }>;
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

	static async list(options: ListPathsOptions) {
		const filter: Record<string, any> = {};
		if (options.public !== undefined) filter.public = options.public;
		if (options.listed !== undefined) filter.listed = options.listed;

		const docs = await PathEndpoints.model
			.find(filter)
			.limit(options.limit || 100)
			.skip(options.skip || 0)
			.sort({ createdAt: -1 })
			.lean();

		return { paths: docs };
	}

	static async getBySlug(slug: string) {
		const doc = await PathEndpoints.model.findOne({ slug }).lean<LearningPath | null>();
		if (!doc) return { path: undefined };

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

	static async create(data: CreatePathData) {
		const doc = await PathEndpoints.model.create({
			...data,
			public: data.public ?? true,
			listed: data.listed ?? true,
		});
		return { path: doc.toObject() };
	}

	static async update(data: UpdatePathData) {
		const { slug, ...updateData } = data;
		const doc = await PathEndpoints.model.findOneAndUpdate({ slug }, updateData, { new: true }).lean();

		if (!doc) {
			throw new Error(`Path with slug "${slug}" not found`);
		}

		return { path: doc };
	}

	static async delete(slug: string) {
		const result = await PathEndpoints.model.deleteOne({ slug });
		return { success: result.deletedCount > 0 };
	}
}
