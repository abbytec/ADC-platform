import type { Model } from "mongoose";
import { create } from "@bufbuild/protobuf";
import {
	type LearningPath,
	type ListPathsRequest,
	type CreatePathRequest,
	type UpdatePathRequest,
	LearningPathSchema,
	PathItemSchema,
	ListPathsResponseSchema,
	GetPathResponseSchema,
	CreatePathResponseSchema,
	UpdatePathResponseSchema,
	DeletePathResponseSchema,
	PathItemType,
	PathItemLevel,
} from "../../../../common/ADC/gen/learning/learning_pb.js";

// Mapeos enum <-> string
const typeToEnum: Record<string, PathItemType> = {
	article: PathItemType.ARTICLE,
	path: PathItemType.PATH,
};

const levelToEnum: Record<string, PathItemLevel> = {
	critico: PathItemLevel.CRITICO,
	importante: PathItemLevel.IMPORTANTE,
	opcional: PathItemLevel.OPCIONAL,
};

const enumToType: Record<PathItemType, string> = {
	[PathItemType.UNSPECIFIED]: "article",
	[PathItemType.ARTICLE]: "article",
	[PathItemType.PATH]: "path",
};

const enumToLevel: Record<PathItemLevel, string> = {
	[PathItemLevel.UNSPECIFIED]: "opcional",
	[PathItemLevel.CRITICO]: "critico",
	[PathItemLevel.IMPORTANTE]: "importante",
	[PathItemLevel.OPCIONAL]: "opcional",
};

function docToProto(doc: LearningPath): LearningPath {
	return create(LearningPathSchema, {
		slug: doc.slug,
		title: doc.title,
		description: doc.description,
		color: doc.color,
		banner: doc.banner,
		public: doc.public,
		listed: doc.listed,
		items: (doc.items || []).map((item) =>
			create(PathItemSchema, {
				slug: item.slug,
				type: typeToEnum[item.type] || PathItemType.ARTICLE,
				level: levelToEnum[item.level] || PathItemLevel.OPCIONAL,
			})
		),
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	});
}

export class PathEndpoints {
	private static model: Model<LearningPath>;

	static init(model: Model<any>) {
		PathEndpoints.model ??= model;
	}

	static async list(req: ListPathsRequest) {
		const filter: Record<string, any> = {};
		if (req.public !== undefined) filter.public = req.public;
		if (req.listed !== undefined) filter.listed = req.listed;

		const docs = await PathEndpoints.model
			.find(filter)
			.limit(req.limit || 100)
			.skip(req.skip || 0)
			.sort({ createdAt: -1 })
			.lean();

		return create(ListPathsResponseSchema, {
			paths: docs.map(docToProto),
		});
	}

	static async getBySlug(slug: string) {
		const doc = await PathEndpoints.model.findOne({ slug }).lean();

		return create(GetPathResponseSchema, {
			path: doc ? docToProto(doc) : undefined,
		});
	}

	static async create(req: CreatePathRequest) {
		const data = {
			slug: req.slug,
			title: req.title,
			description: req.description,
			color: req.color,
			banner: req.banner,
			public: req.public ?? true,
			listed: req.listed ?? true,
			items: req.items.map((item) => ({
				slug: item.slug,
				type: enumToType[item.type],
				level: enumToLevel[item.level],
			})),
		};

		const doc = await PathEndpoints.model.create(data);

		return create(CreatePathResponseSchema, {
			path: docToProto(doc.toObject()),
		});
	}

	static async update(req: UpdatePathRequest) {
		const data: Record<string, any> = {};
		if (req.title !== undefined) data.title = req.title;
		if (req.description !== undefined) data.description = req.description;
		if (req.color !== undefined) data.color = req.color;
		if (req.banner !== undefined) data.banner = req.banner;
		if (req.public !== undefined) data.public = req.public;
		if (req.listed !== undefined) data.listed = req.listed;
		if (req.items.length > 0) {
			data.items = req.items.map((item) => ({
				slug: item.slug,
				type: enumToType[item.type],
				level: enumToLevel[item.level],
			}));
		}

		const doc = await PathEndpoints.model.findOneAndUpdate({ slug: req.slug }, data, { new: true }).lean();

		if (!doc) {
			throw new Error(`Path with slug "${req.slug}" not found`);
		}

		return create(UpdatePathResponseSchema, {
			path: docToProto(doc),
		});
	}

	static async delete(slug: string) {
		const result = await PathEndpoints.model.deleteOne({ slug });

		return create(DeletePathResponseSchema, {
			success: result.deletedCount > 0,
		});
	}
}
