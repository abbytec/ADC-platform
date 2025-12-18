import type { Model } from "mongoose";
import type { ILearningPath } from "../models/path.model.js";

export class PathEndpoints {
	constructor(private model: Model<ILearningPath>) {}

	async list(req: { public?: boolean; listed?: boolean; limit?: number; skip?: number }) {
		const filter: any = {};

		if (req.public !== undefined) {
			filter.public = req.public;
		}

		if (req.listed !== undefined) {
			filter.listed = req.listed;
		}

		const limit = req.limit || 100;
		const skip = req.skip || 0;

		return await this.model.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }).lean();
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
			throw new Error(`Path with slug "${slug}" not found`);
		}

		return doc;
	}

	async delete(slug: string) {
		const result = await this.model.deleteOne({ slug });
		return { success: result.deletedCount > 0 };
	}
}
