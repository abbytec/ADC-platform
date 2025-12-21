import type { Model } from "mongoose";
import type { ILearningPath } from "../models/path.model.js";

export class PathEndpoints {
	private static model: Model<ILearningPath>;

	static init(model: Model<ILearningPath>) {
		PathEndpoints.model ??= model;
	}

	static async list(req: { public?: boolean; listed?: boolean; limit?: number; skip?: number }) {
		const filter: any = {};

		if (req.public !== undefined) {
			filter.public = req.public;
		}

		if (req.listed !== undefined) {
			filter.listed = req.listed;
		}

		const limit = req.limit || 100;
		const skip = req.skip || 0;

		return await PathEndpoints.model.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }).lean();
	}

	static async getBySlug(slug: string) {
		return await PathEndpoints.model.findOne({ slug }).lean();
	}

	static async create(data: any) {
		const doc = await PathEndpoints.model.create(data);
		return doc.toObject();
	}

	static async update(slug: string, data: any) {
		const doc = await PathEndpoints.model.findOneAndUpdate({ slug }, data, { new: true }).lean();

		if (!doc) {
			throw new Error(`Path with slug "${slug}" not found`);
		}

		return doc;
	}

	static async delete(slug: string) {
		const result = await PathEndpoints.model.deleteOne({ slug });
		return { success: result.deletedCount > 0 };
	}
}
