import type { Model } from "mongoose";
import type { LearningPath } from "../../../../common/ADC/types/learning.js";

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

export class PathEndpoints {
	private static model: Model<LearningPath>;

	static init(model: Model<any>) {
		PathEndpoints.model ??= model;
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
		const doc = await PathEndpoints.model.findOne({ slug }).lean();
		return { path: doc || undefined };
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
